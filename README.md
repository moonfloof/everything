# tombo-is-server

aka. tombo-everything

API to track everything I do and store it in a secure SQLite database

* Location Tracking (`/api/overland` matches [Overland API](https://github.com/aaronpk/Overland-iOS#api))
* Scrobbles (`/api/scrobble` matches [ListenBrainz API](https://listenbrainz-server.readthedocs.io/en/latest/dev/api.html)) _planned_

## Installation

* Create a SQLite database using the latest migration
* Add at least one device to the `devices` table (where `id` is a UUID)
* `npm install`
* Copy `.env.template` to `.env` and modify values as you see fit
* `npm run start:production` (or your preferred way of managing node applications, eg. forever)
