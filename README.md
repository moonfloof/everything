# Everything (Quantified-Self Data Tracker)

Taking ownership of my data is important to me. While I can't get the very
granular details that the likes of Google and TikTok can (e.g. watch time of
specific parts of videos down to the millisecond⁉), I like to collect as much as
I can, so that if any one services gets shut down, I'll still have my own copy.
Furthermore, I'm making a lot of it public so that advertisers don't have quite
an upperhand on the things I like to consume.

If this also applies to you, you might consider using Everything (for lack
of a better name!).

---

There are various types of data that can be stored, half of which is completely
automatic, and another half which may require manual input (until I figure out a
better way to do it).

## Automatic/External Data Sources

* **Location Tracking** - Using the
  [Overland API](https://github.com/aaronpk/Overland-iOS#api) by
  [Aaron Parecki](https://aaronparecki.com/). Also updates latest phone battery.
* **Scrobbles** - Custom implementation of the
  [ListenBrainz API](https://listenbrainz-server.readthedocs.io/en/latest/dev/api.html), point your scrobbler to `/api/listenbrainz`
* **YouTube Likes** - Polls the
  [Google API](https://developers.google.com/youtube/v3/) to get newly liked
  videos, or automate POST requests using IFTTT (I have found the former to be
  quite flaky, so rely on IFTTT).
* **Steam game activity** - Polls the
  [Steam Web API](https://developer.valvesoftware.com/wiki/Steam_Web_API) to get
  recently played games
* **Films/Movies** - Polls your [Letterboxd](https://letterboxd.com) profile for
  newly logged films to your diary.
* **Card purchases** - Create a
  [Monzo webhook](https://docs.monzo.com/#webhooks) to automatically POST to
  `/api/purchases` whenever you make a purchase (or get paid).

## Manual Data Entry

Data is entered using the internal CRUD API.

* **Health** - All hidden from public view except sleep, which is heavily
  aggregated.
  * Sleep
  * Time-tracking
  * Steps
  * Food
  * Weight
* **TV Shows** - [Sonarr](https://sonarr.tv/) installed locally, to get a list
  of series and episodes to pick from.
* **Scrobbles** - [Subsonic API](http://www.subsonic.org/pages/api.jsp)
  installed locally, to get a list of artists and their albums (this is great
  for listening to physical media, where scrobbling is not automatic).
* **Books** - Also stores progress using page numbers (eg. read 48 pages,
  total 230 pages, therefore progress is 21%)
* **Web Bookmarks** - this can be automated by connecting Pocket through IFTTT,
  and making a POST request to `/api/bookmarks` with a JSON body containing
  `apiKey`, `title`, `url` as properties.

---

## Installation

### Prerequisites

* Create a SQLite database file, running all the migrations in order of date
  inside the `migrations` folder
* Add at least one device to the `devices` table (where `id` is a UUID)
* Copy `.env.template` to `.env` and modify values as you see fit. **Most of the
  setup instructions you'll need already appear within the .env file**, as they
  are specific to each service you'd like to track.

### Running NPM on bare metal

* `npm install`
* `npm run start:production` (or your preferred way of managing node 
  applications, eg. `forever`, `pm2`, etc)

### Running via Docker

The `Dockerfile` and `docker-compose.yml` have been set up in such a way that
you should only need to edit the `.env` file to make configuration changes. As
such, all that's required is:

* `docker compose up -d`
