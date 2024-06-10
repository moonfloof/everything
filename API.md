# API Documentation

## Requirements

### Server URL

This guide assumes your server is installed at `example.com`, although you can
change this address to match your actual installed location.

This address should be available to any devices that will be communicating with
it. For example, if you wish to scrobble using 4G, the **external** API should
be publicly accessible.

The internal API should **ALWAYS** remain hidden behind a firewall, as it allows
direct manipulation of the database without authentication.

### Devices and API Keys

You may want to keep track of individual devices which submit data to the API.
To submit _any_ data to the API, you will need at least one device, which will
have been set up after you start the server for the first time. If you wish to
add more, go to the "devices" table within the database, and add a new device
there. Your device ID must be a randomly generated UUID, and you should keep
your API key secure.

For future reference in this document, `<API-KEY>` refers to an API key
generated for a device in this database.

### A note about inconsistencies

Unfortunately, due to connecting to various services, several of these endpoints
are not consistent with the others (eg. sending `apiKey` as a body parameter, or
in the URL, or as an HTTP header). While I have also tried to make the response
payload consistent across all the endpoints, some are still different, so if you
choose to connect to these endpoints manually, please check that you are sending
the correct authorisation parameters and checking for the correct responses.

## Scrobbles / ListenBrainz

The main scrobbling endpoint matches the official ListenBrainz one - you should
only need to change the endpoint from `https://api.listenbrainz.org` to
`https://example.com/api/listenbrainz`

### Scrobble Song(s) - POST `/api/listenbrainz/1/submit-listens`

#### Headers

* **`Authorization`**: `token <API-KEY>` (eg. `token e2cbe426-d193-...`)
* **`Content-Type`**: `application/json`

#### Payload

* `listen_type`: "single", "import", or "playing_now".  
  if you send "playing_now", it will set the currently played track on the
  website, but will not save the scrobble to the database. This usually happens
  at the start of the song, and a "single" payload will be sent near the end.
* `payload`, an array of objects, containing the following properties:
  * `listened_at`: unix timestamp in seconds
  * `track_metadata`, an object containing the following properties:
    * `artist_name`
    * `track_name`
    * `release_name`
    * `additional_info`, an **optional** object containing the following
      properties:
      * `date`: The date this song/album was released, in ISO8601 format
      * `tags`: An array of strings, containing the music genres of the track
      * `tracknumber`: An integer

Typically, more information about this track may be included by scrobblers, but
the information provided above is all Everything uses to store scrobbles.

#### Payload Example

```json
{
  "listen_type": "single",
  "payload": [
    {
      "listened_at": 1717347046,
      "track_metadata": {
        "artist_name": "TomboFry",
        "release_name": "Floating Amongst the Stars",
        "track_name": "Taken For a Ride",
        "additional_info": {
          "date": "2024-04-26",
          "tags": ["Progressive Rock", "Indie Rock"],
          "tracknumber": 2
        }
      }
    }
  ]
}
```

#### Responses

200, successful response:

```json
{
  "status": "ok"
}
```

500, failure:

```json
{
  "status": "error",
  "code": 500,
  "error": "Information about the error"
}
```

### Validate Token - GET `/api/listenbrainz/1/validate-token?token=<API-KEY>`

No headers required, no payload required.

#### Responses

200, **valid** token

```json
{
  "code": 200,
  "message": "Token valid.",
  "valid": true,
  "user": "A description about this device"
}
```

200, **invalid** token

```json
{
  "code": 200,
  "message": "Token invalid.",
  "valid": false
}
```

## YouTube Liked Videos

You can set up automation services - such as IFTTT or Zapier - to POST to this
endpoint when periodically checking your Liked Videos playlist on YouTube.
Alternatively, you can also set up an iOS Shortcut to POST to this endpoint when
receiving YouTube URLs from the Share sheet for manual submissions.

### New Liked Video - POST `/api/youtube/like`

#### Headers

* **`Content-Type`**: `application/json`

#### Payload

* `url`: The YouTube URL, can be in the format `youtube.com/watch?v=...` or
  `youtu.be/...`
* `title`: Optional, to override the real title of the video
* `created_at`: Optional, to override the liked date, in ISO8601 format
* `apiKey`: Value of `<API-KEY>`

#### Payload Example

```json
{
  "url": "https://www.youtube.com/watch?v=4Q0p2WnVvMU",
  "title": "Floating Amongst The Stars (Official Lyric Video)",
  "created_at": "2024-01-01T09:00:00.000Z",
  "apiKey": "0ccdd0ad-dd26-...",
}
```

#### Responses

200, successful:

```json
{
  "status": "ok"
}
```

400, failure:

```json
{
  "status": "Information about the error"
}
```

## Bookmarks

You can set up automation services - such as IFTTT or Zapier - to POST to this
endpoint when periodically checking other services, such as Pocket.
Alternatively, you can also set up an iOS Shortcut to POST to this endpoint when
receiving URLs from the Share sheet for manual submissions.

### New Bookmark - POST `/api/bookmarks`

#### Headers

* **`Content-Type`**: `application/json`

#### Payload

* `apiKey`: Value of `<API-KEY>`
* `url`: The page URL being bookmarked
* `title`: The title of the page
* `created_at`: Optional, set a custom date, in ISO8601 date/time format

#### Payload Example

```json
{
  "url": "https://floof.fm/",
  "title": "moonfloof",
  "apiKey": "a732cb0b-c24f-...",
  "created_at": "2024-01-01T09:45:00.000Z"
}
```

#### Responses

200, successful:

```json
{
  "status": "ok"
}
```

400, failure:

```json
{
  "status": "Information about the error."
}
```

## Devices (Location, Battery)

### Battery Status - POST `/api/device/battery`

#### Headers

* **`Authorization`**: `<API-KEY>` (do not include "Bearer" or "token")
* **`Content-Type`**: `application/json`

#### Payload

* `battery_level`: A number between 0.0 and 1.0 (eg. `0.56` is 56%)
* `battery_state`: One of: `true`, `false`, or a free-form string containing the
  state (eg. "charging", "unplugged", etc)

#### Payload Example

```json
{
  "battery_level": 0.56,
  "battery_state": "charging"
}
```

#### Responses

200, successful:

```json
{
  "status": "ok"
}
```

400, failure:

```json
{
  "status": "err",
  "message": "Information about the error"
}
```

### Location Tracking - POST `/api/device/overland?apiKey=<API-KEY>`

An endpoint which follows the [Overland API
specification](https://github.com/aaronpk/Overland-iOS?tab=readme-ov-file#api),
which can be used with the Overland app for Android or iOS to log your location.

You can set the app up by changing the Server URL in the Settings tab as
follows: `https://example.com/api/device/overland?apiKey=<API-KEY>`

Make sure you put your API key in the URL query, but otherwise the payload and
response information can be found in the link above.

## Health (Steps, Weight, Food, Timetracking)

**NOTE:** All endpoints in this category require the following headers, and
return the same responses:

### Headers

* **`Authorization`:** `<API-KEY>` (do not include "Bearer" or "token")
* **`Content-Type`:** `application/json`

### Responses

200, successful:

```json
{
  "status": "ok"
}
```

400, failure:

```json
{
  "status": "Information about the error."
}
```

### Steps - POST `/api/health/steps`

💡 If you're tracking steps with Apple Health, you could set up an automation
using Shortcuts to fetch the number of steps taken today, and POST it to this
endpoint at 23:59 every day.

#### Payload

* `created_at`: the date you're logging steps for, in `YYYY-MM-DD` format. You
  _can_ provide a full ISO8601 date but it will be truncated to the whole day in
  the database, so you only need to log this once per day. If **not** provided,
  the API will default to the current date.
* `steps`: number of steps taken on this day

#### Payload Example

```json
{
  "created_at": "2024-01-01",
  "steps": 3056
}
```

### Weight - POST `/api/health/weight`

💡 You could set up an iOS Shortcut to log your weight to both Apple Health
**and** POST to this endpoint at the same time.

#### Payload

* `created_at`: the date you're logging weight for, in `YYYY-MM-DD` format. You
  _can_ provide a full ISO8601 date but it will be truncated to the whole day in
  the database, so you only need to log this once per day. If **not** provided,
  the API will default to the current date.
* `weight_kgs`: weight in kilograms, as a number (technically there's nothing
  stopping you from logging pounds, stone, or some other unit).

#### Payload Example

```json
{
  "created_at": "2024-01-01",
  "weight_kgs": 70.0
}
```

### Food - POST `/api/health/food`

#### Payload

* `created_at`: full date/time in ISO8601 format. If **not** provided, the API
  will default to the current date/time.
* `name`: what you're currently eating/drinking
* `type`: used to categorise food types. You may wish to track takeouts,
  caffeinated drinks, and normal meals separately from one another. Some
  examples include: "food", "drink", "soft drink", "coffee", "tea", "takeout",
  "snack", etc. If **not** provided, the API will default to "food".

#### Payload Example

```json
{
  "created_at": "2024-01-01T09:00:00.000Z",
  "name": "Chicken and mushroom curry",
  "type": "takeout"
}
```

### Time Tracking - POST `/api/health/time`

💡 You could set up an iOS Shortcut to display a list of categories, then POST
to this endpoint to start/end a session.

#### Payload

* `created_at`: date/time, in ISO8601
* `ended_at`: date/time, in ISO8601
* `category`: what you're time tracking

You do not have to provide `created_at` or `ended_at` - if you send a payload
without dates, it will start timetracking at the current date/time. If you send
another payload afterwards, the previous session will end and a new one will
begin at the current date/time. You can send `created_at` without `ended_at` if
you wish to start a timetracking session with a custom date/time.

Also, if you send the `category` as "stop" while a session is currently running,
it will end the session.

#### Payload Examples

Start a sleep session (which will end an existing session, if it is running):

```json
{
  "category": "sleep"
}
```

Start a cooking/eating session, which will start the session at the specifed
time, and end the previous session at that time as well.

```json
{
  "category": "cooking / eating",
  "created_at": "2024-01-01T09:00:00.000Z"
}
```

## Purchases (Monzo webhook)

To keep track of your income/outgoings, you'll need to [set up a webhook using
your Monzo account](https://developers.monzo.com/), and point it to the
following address: `https://example.com/api/purchases?apiKey=<API-KEY>`.

Alternatively, if you don't have a Monzo account, you can still post to this
endpoint using the following payload.

### Add Transaction - POST `/api/purchases`

#### Headers

* **`Content-Type`:** `application/json`

#### Payload

* `account_id`: string, which MUST match the `TOMBOIS_MONZO_ACCOUNT_ID` value
  provided in `.env`, otherwise an error will be thrown
* `amount`: number, an outgoing payment is negative, and 100 times the amount of
  the transaction (eg. 5.49 is `-549`). Income is positive (eg. 15.32 is `1532`)
* `currency`: The 3-letter code of the currency used by the transaction (eg. £
  is `GBP`, and $ could be `USD`, `AUD`, `NZD`, etc.)
* `created`: the date/time of the transaction in ISO8601 format.
* `category`: arbitrary value used to categorise the transaction.
* `description`: arbitrary value - will only be used if merchant name is not
  provided
* `merchant`: an object containing the following properties:
  * `name`: The name of the store/website/service the transaction was made with.

#### Payload Example

```json
{
  "account_id": "acc_df50c4ee-1333-...",
  "amount": -500,
  "currency": "GBP",
  "created": "2024-01-01T09:00:00.000Z",
  "category": "groceries",
  "merchant": {
    "name": "Tesco"
  }
}
```

#### Responses

200, successful:

```json
{
  "status": "ok"
}
```

400, failure:

```json
{
  "status": "Information about the error."
}
```
