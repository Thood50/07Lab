'use strict';

const express = require('express');
const superagent = require('superagent');
const pg = require('pg');
const cors = require('cors');
require('dotenv').config();
const app = express();
const PORT = process.env.PORT;
app.use(cors());


const client = new pg.Client(process.env.DATABASE_URL);
client.connect();
client.on('error', err => console.error(err));


// +++++++++++++++ ROUTES ++++++++++++++++++++++

app.get('/location', getLocation);

app.get('/weather', getWeather);

app.get('/yelp', getYelp);

app.get('/movies', getMovies);

app.get('/meetups', getMeetup);

app.get('/trails', getTrails);

app.listen(PORT, () => console.log(`App is up on ${PORT}`));


//+++++++++++++++++++++ MODELS +++++++++++++++++++++++++++++++++

function Location(query, res) {
  this.tableName = 'locations';
  this.search_query = query;
  this.formatted_query = res.body.results[0].formatted_address;
  this.latitude = res.body.results[0].geometry.location.lat;
  this.longitude = res.body.results[0].geometry.location.lng;
  this.created_at = Date.now();
}

function Weather(day) {
  this.tableName = 'weathers';
  this.forecast = day.summary;
  this.time = new Date(day.time * 1000).toString().slice(0, 15);
  this.created_at = Date.now();
}

Weather.tableName = 'weathers';
Weather.lookup = lookup;
Weather.deleteByLocationId = deleteByLocationId;

function Yelp(restaurant) {
  this.tableName = 'yelps';
  this.url = restaurant.url;
  this.name = restaurant.name;
  this.rating = restaurant.rating;
  this.price = restaurant.price;
  this.image_url = restaurant.image_url;
  this.created_at = Date.now();
}

Yelp.tableName = 'yelps';
Yelp.lookup = lookup;
Yelp.deleteByLocationId = deleteByLocationId;

function Movie(movie) {
  this.tableName = 'movies';
  this.title = movie.title;
  this.released_on = movie.release_date;
  this.average_votes = movie.vote_average;
  this.total_votes = movie.vote_count;
  this.image_url = `http://image.tmdb.org/t/p/w185/${movie.poster_path}`
  this.overview = movie.overview;
  this.popularity = movie.popularity
  this.created_at = Date.now();
}

Movie.tableName = 'movies'
Movie.lookup = lookup;
Movie.deleteByLocationId = deleteByLocationId;

function Meetup(meetup) {
  this.tableName = 'meetups';
  this.link = meetup.link;
  this.name = meetup.name;
  this.host = meetup.group.name;
  this.creation_date = new Date(meetup.created).toString().slice(0,15);
  this.created_at = Date.now();
}

Meetup.tableName = 'meetups'
Meetup.lookup = lookup;
Meetup.deleteByLocationId = deleteByLocationId;

function Trail (trail){
  this.tableName = 'trails';
  this.trail_url = trail.url;
  this.name = trail.name;
  this.location = trail.location;
  this.length = trail.length;
  this.condition_date = trail.conditionDate.split(' ', [0]);
  this.condition_time = trail.conditionDate.split(' ', [1]);
  this.conditions = trail.conditionDetails;
  this.stars = trail.stars;
  this.star_votes = trail.starVotes;
  this.summary = trail.summary;
  this.created_at = Date.now();
}

Trail.tableName = 'trails'
Trail.lookup = lookup;
Trail.deleteByLocationId = deleteByLocationId;

// +++++++++++++++++ PROTOTYPE ++++++++++++++++++++++++++++

Location.prototype = {
  save: function () {
    const SQL = `INSERT INTO locations (search_query, formatted_query, latitude, longitude) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING id;`;
    const values = [this.search_query, this.formatted_query, this.latitude, this.longitude];

    return client.query(SQL, values)
      .then(result => {
        this.id = result.rows[0].id;
        return this;
      });
  }
};

Weather.prototype = {
  save: function (location_id) {
    const SQL = `INSERT INTO ${this.tableName} (forecast, time, created_at, location_id) VALUES ($1, $2, $3, $4);`;
    const values = [this.forecast, this.time, this.created_at, location_id];

    client.query(SQL, values);
  }
}

Yelp.prototype = {
  save: function (location_id){
    const SQL = `INSERT INTO ${this.tableName} (url, name, rating, price, image_url, created_at, location_id) VALUES ($1, $2, $3, $4, $5, $6, $7);`;
    const values = [this.url, this.name, this.rating, this.price, this.image_url, this.created_at, location_id];

    client.query(SQL, values);
  }
}

Movie.prototype = {
  save: function (location_id){
    const SQL = `INSERT INTO ${this.tableName} (title, released_on, average_votes, total_votes, image_url, overview, popularity, created_at, location_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`;
    const values = [this.title, this.released_on, this.average_votes, this.total_votes, this.image_url, this.overview, this.popularity, this.created_at, location_id];

    client.query(SQL, values);
  }
}

Meetup.prototype = {
  save: function(location_id){
    const SQL = `INSERT INTO ${this.tableName} (link, name, host, creation_date, created_at, location_id) VALUES ($1, $2, $3, $4, $5, $6);`;
    const values = [this.link, this.name, this.host, this.creation_date, this.created_at, location_id];

    client.query(SQL, values);
  }
}

Trail.prototype = {
  save: function(location_id){
    const SQL = `INSERT INTO ${this.tableName} (trail_url, name, location, length, condition_date, condition_time, conditions, stars, star_votes, summary, created_at, location_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);`;
    const values = [this.trail_url, this.name, this.location, this.length, this.condition_date, this.condition_time, this.conditions, this.stars, this.star_votes, this.summary, this.created_at, location_id];

    client.query(SQL, values);
  }
}

// ++++++++++++ HELPERS +++++++++++++++
Location.lookupLocation = (location) => {
  const SQL = `SELECT * FROM locations WHERE search_query=$1;`;
  const values = [location.query];

  return client.query(SQL, values)
    .then(result => {
      if (result.rowCount > 0) {
        location.cacheHit(result);
      } else {
        location.cacheMiss();
      }
    })
    .catch(console.error);
}

function lookup(options) {
  const SQL = `SELECT * FROM ${options.tableName} WHERE location_id=$1;`;
  const values = [options.location];

  client.query(SQL, values)
    .then(result => {
      if (result.rowCount > 0) {
        options.cacheHit(result);
      } else {
        options.cacheMiss();
      }
    })
    .catch(error => handleError(error));
}

function deleteByLocationId(table, city) {
  const SQL = `DELETE from ${table} WHERE location_id=${city};`;
  return client.query(SQL);
}

// ++++++++++++ HANDLERS ++++++++++++++++

function handleError(err, res) {
  console.error(err);
  if (res) res.status(500).send('Sorry, something went wrong');
}

function getLocation(request, response) {
  Location.lookupLocation({
    tableName: Location.tableName,

    query: request.query.data,

    cacheHit: function (result) {
      response.send(result.rows[0]);
    },

    cacheMiss: function () {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${this.query}&key=${process.env.GEOCODE_API_KEY}`;

      return superagent.get(url)
        .then(result => {
          const location = new Location(this.query, result);
          location.save()
            .then(location => response.send(location));
        })
        .catch(error => handleError(error));
    }
  })
}

function getWeather(request, response) {
  Weather.lookup({
    tableName: Weather.tableName,

    location: request.query.data.id,

    cacheHit: function (result) {
      let ageOfResultsInMinutes = (Date.now() - result.rows[0].created_at) / (1000 * 60);
      if (ageOfResultsInMinutes > 30) {
        Weather.deleteByLocationId(Weather.tableName, request.query.data.id);
        this.cacheMiss();
      } else {
        response.send(result.rows);
      }
    },

    cacheMiss: function () {
      const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${request.query.data.latitude},${request.query.data.longitude}`;

      return superagent.get(url)
        .then(result => {
          const yelpReviews = result.body.daily.data.map(day => {
            const summary = new Weather(day);
            summary.save(request.query.data.id);
            return summary;
          });
          response.send(yelpReviews);
        })
        .catch(error => handleError(error, response));
    }
  })
}

function getYelp(request, response) {
  Yelp.lookup({
    tableName: Yelp.tableName,

    location: request.query.data.id,

    cacheHit: function (result) {
      let ageOfResultsInMinutes = (Date.now() - result.rows[0].created_at) / (1000 * 60 * 60 * 24);
      if (ageOfResultsInMinutes > 7) {
        Yelp.deleteByLocationId(Yelp.tableName, request.query.data.id);
        this.cacheMiss();
      } else {
        response.send(result.rows);
      }
    },

    cacheMiss: function () {
      const url = `https://api.yelp.com/v3/businesses/search?term=restaurants&latitude=${request.query.data.latitude}&longitude=${request.query.data.longitude}`;

      return superagent.get(url)
        .set('Authorization', `Bearer ${process.env.YELP_API_KEY}`)
        .then(result => {
          const yelpBusinesses = result.body.businesses.map(restaurant => {
            const business = new Yelp(restaurant);
            business.save(request.query.data.id);
            return business;
          });
          response.send(yelpBusinesses);
        })
        .catch(error => handleError(error, response));
    }
  })
}

function getMovies(request, response) {
  Movie.lookup({
    tableName: Movie.tableName,

    location: request.query.data.id,

    cacheHit: function (result) {
      let ageOfResultsInMinutes = (Date.now() - result.rows[0].created_at) / (1000 * 60 * 60 * 24);
      if (ageOfResultsInMinutes > 7) {
        Movie.deleteByLocationId(Movie.tableName, request.query.data.id);
        this.cacheMiss();
      } else {
        response.send(result.rows);
      }
    },

    cacheMiss: function () {
      const url = `https://api.themoviedb.org/3/search/movie?query=${request.query.data.search_query}&api_key=${process.env.MOVIES_API_KEY}`
      return superagent.get(url)
        .then(result => {
          const movieSet = result.body.results.map( movie => {
            const movieTitle = new Movie(movie);
            movieTitle.save(request.query.data.id);
            return movieTitle;
          });
          response.send(movieSet);
        })
        .catch(error => handleError(error, response));
    }
  })
}

function getMeetup(request, response) {
  Meetup.lookup({
    tableName: Meetup.tableName,

    location: request.query.data.id,

    cacheHit: function (result) {
      let ageOfResultsInMinutes = (Date.now() - result.rows[0].created_at) / (1000 * 60 * 60 * 24);
      if (ageOfResultsInMinutes > 1) {
        Meetup.deleteByLocationId(Meetup.tableName, request.query.data.id);
        this.cacheMiss();
      } else {
        response.send(result.rows);
      }
    },

    cacheMiss: function () {
      const url = `https://api.meetup.com/find/upcoming_events?key=${process.env.MEETUP_API_KEY}&lon=${request.query.data.longitude}&page=20&lat=${request.query.data.latitude}`
      return superagent.get(url)
        .then(result => {
          const meetups = result.body.events.map( meetup => {
            const meetupEvent = new Meetup(meetup);
            meetupEvent.save(request.query.data.id);
            return meetupEvent;
          });
          response.send(meetups);
        })
        .catch(error => handleError(error, response));
    }
  })
}

function getTrails(request, response) {
  Trail.lookup({
    tableName: Trail.tableName,

    location: request.query.data.id,

    cacheHit: function (result) {
      let ageOfResultsInMinutes = (Date.now() - result.rows[0].created_at) / (1000 * 60 * 60 * 24);
      if (ageOfResultsInMinutes > 1) {
        Trail.deleteByLocationId(Trail.tableName, request.query.data.id);
        this.cacheMiss();
      } else {
        response.send(result.rows);
      }
    },

    cacheMiss: function () {
      const url = `https://www.hikingproject.com/data/get-trails?lat=${request.query.data.latitude}&lon=${request.query.data.longitude}&maxDistance=10&key=${process.env.TRAILS_API_KEY}`
      return superagent.get(url)
        .then(result => {
          const trails = result.body.trails.map( trail => {
            const hikeTrail = new Trail(trail);
            hikeTrail.save(request.query.data.id);
            return hikeTrail;
          });
          response.send(trails);
        })
        .catch(error => handleError(error, response));
    }
  })
}
