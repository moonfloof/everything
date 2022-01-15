# Everything (Personal Tracker)

API to track everything I do and store it in an SQLite database

* Location Tracking (`/api/overland` matches
  [Overland API](https://github.com/aaronpk/Overland-iOS#api)) - also includes
  phone battery status
* Scrobbles (`/api/scrobble` matches [ListenBrainz API](https://listenbrainz-server.readthedocs.io/en/latest/dev/api.html))
* YouTube Likes - Either send requests via IFTTT, or use the Google API to poll
  for liked videos (I have found the latter to be quite flaky)
* Steam game activity
* Web Bookmarks
* Health (time-tracking, sleep, steps, food, weight) - Currently all manual 
  input using the internal CRUD-API

## Installation

* Create a SQLite database, running all the migrations in order of date inside
  the `migrations` folder
* Add at least one device to the `devices` table (where `id` is a UUID)
* `npm install`
* Copy `.env.template` to `.env` and modify values as you see fit
* `npm run start:production` (or your preferred way of managing node 
  applications, eg. `forever`, `pm2`, etc)
