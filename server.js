'use strict';

// Application Dependencies
const express = require('express');
const superagent = require('superagent');
const cors = require('cors');

// Load environment variables from .env file
require('dotenv').config();

// Application Setup
const app = express();
const PORT = process.env.PORT;
app.use(cors());

// API Routes
app.get('/location', (request, response) => {
  searchToLatLong(request.query.data)
    .then(location => response.send(location))
    .catch(error => handleError(error, response));
})

app.get('/weather', getWeather);

app.get('/movies', getMovies);

app.get('/yelp', getYelp);

app.get('/trails', getTrails);

app.get('/meetups', getMeetups);

// Make sure the server is listening for requests
app.listen(PORT, () => console.log(`Listening on ${PORT}`));

// Error handler
function handleError(err, res) {
  console.error(err);
  if (res) res.status(500).send('Sorry, something went wrong');
}

// Models
function Location(query, res) {
  this.search_query = query;
  this.formatted_query = res.body.results[0].formatted_address;
  this.latitude = res.body.results[0].geometry.location.lat;
  this.longitude = res.body.results[0].geometry.location.lng;
}

function Weather(day) {
  this.forecast = day.summary;
  this.time = new Date(day.time * 1000).toString().slice(0, 15);
}

function Movies(movie) {
  this.title = movie.title;
  this.released_on = movie.release_date;
  this.total_votes = movie.vote_count;
  this.average_votes = movie.vote_average;
  this.popularity = movie.popularity;
  this.image_url = `https://image.tmdb.org/t/p/original${movie.poster_path}`;
  this.overiew = movie.overview;
}

function Yelp(business) {
  this.name = business.name;
  this.url = business.url;
  this.image_url = business.image_url;
  this.rating = business.rating;
  this.price = business.price;
}

function Trails(route) {
  this.name = route.name;
  this.trail_url = route.url;
  this.location = route.location;
  this.length = route.length;
  this.condition_date = route.conditionDate.match(/[0-9][0-9][0-9][0-9][-][0-9][0-9][-][0-9][0-9]/g);
  this.condition_time = route.conditionDate.match(/[0-9][0-9][:][0-9][0-9][:][0-9][0-9]/g);
  this.conditions = route.conditionStatus;
  this.stars = route.stars;
  this.star_votes = route.starVotes;
  this.summary = route.summary;
}

function Meetup(meet) {
  this.link = meet.link;
  this.name = meet.urlkey;
  this.host = meet.name;
  this.creation_date = meet.updated;
}


// Helper Functions
function searchToLatLong(query) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${process.env.GEOCODE_API_KEY}`;

  return superagent.get(url)
    .then(res => {
      return new Location(query, res);
    })
    .catch(error => handleError(error));
}

function getWeather(request, response) {
  const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${request.query.data.latitude},${request.query.data.longitude}`;

  superagent.get(url)
    .then(result => {
      const weatherSummaries = result.body.daily.data.map(day => {
        return new Weather(day);
      });

      response.send(weatherSummaries);
    })
    .catch(error => handleError(error, response));
}

function getMovies(request, response) {
  const url =`https://api.themoviedb.org/3/search/movie?api_key=${process.env.MOVIES_API_KEY}&language=en-US&query=${request.query.data.search_query}&page=1&include_adult=false`;

  superagent.get(url)
    .then(result => {
      const movies = result.body.results.map(movie => {
        return new Movies(movie);
      });
      response.send(movies);
    })
    .catch(error => handleError(error, response));
}

function getYelp(request, response) {
  const url = `https://api.yelp.com/v3/businesses/search?latitude=${request.query.data.latitude}&longitude=${request.query.data.longitude}`;

  superagent.get(url).set('Authorization', `Bearer ${process.env.YELP_API_KEY}`)
    .then(result => {
      const theBusiness = result.body.businesses.map(business => {
        return new Yelp(business);
      });
      response.send(theBusiness);
    })
    .catch(error => handleError(error, response));
}

function getTrails(request, response) {
  const url = `https://www.hikingproject.com/data/get-trails?lat=${request.query.data.latitude}&lon=${request.query.data.longitude}&key=${process.env.TRAILS_API_KEY}`

  superagent.get(url)
    .then(result => {
      const trails = result.body.trails.map(trail => {
        return new Trails(trail);
      })
      response.send(trails);
    })
    .catch(error => handleError(error, response));
}

function getMeetups(request, response) {
  const url = `https://api.meetup.com/topics?search=tech&key=${process.env.MEETUP_API_KEY}`;

  superagent.get(url)
    .then(result => {
      const meetup = result.body.results.map(meet => {
        return new Meetup(meet);
      })
      console.log(meetup);
      response.send(meetup);
    })
    .catch(error => handleError(error, response));
}


//Time Converter
function timeConverter(UNIX_timestamp){
  let a = new Date(UNIX_timestamp * 1000);
  
  let months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  // let year = a.getFullYear();
  let month = months[a.getMonth()];
  let date = a.getDate();
  let hour = a.getHours();
  let min = a.getMinutes();
  let sec = a.getSeconds();
  let time = date + ' ' + month + ' ' + '2018' + ' ' + hour + ':' + min + ':' + sec ;
  return time;
}
