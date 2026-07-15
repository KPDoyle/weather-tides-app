# Weather & Tides

A responsive static web app for weather, marine conditions and tides at any selected location.

## Features
- Global town, harbour and postcode search
- Current weather and 24-hour forecast
- 10-day outlook
- Wind, gusts, rain, humidity, pressure, cloud, visibility and UV
- Wave height/direction/period, swell, sea temperature and ocean current
- Modelled sea-level tide curve and inferred high/low points
- Optional WorldTides API key for dedicated tide heights and extrema
- Metric/imperial switch
- Browser geolocation
- Vercel-ready with no build step

## Run locally
Open `index.html` in a browser. For best results, serve the folder using any static web server.

## Deploy to Vercel
1. Upload this folder to GitHub.
2. In Vercel, choose **Add New → Project** and import the repository.
3. Framework preset: **Other**.
4. Leave build command blank and set output directory to `.`.
5. Deploy.

## Data sources
Weather and marine data are provided by Open-Meteo. Dedicated tide predictions can be provided by WorldTides when the user supplies an API key in the app settings.

Marine and modelled sea-level information is not suitable for navigation or safety-critical decisions.
