# Google Places API Setup Guide

## Overview
The dealer search feature uses Google Places API to find farm equipment dealers near a location.

## Setup Steps

### 1. Get Google Places API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the following APIs:
   - **Places API** (for dealer search)
   - **Geocoding API** (for location lookup)
4. Go to **Credentials** → **Create Credentials** → **API Key**
5. Copy your API key

### 2. Restrict Your API Key (Recommended)

1. Click on your API key in the credentials page
2. Under **API restrictions**, select:
   - Places API
   - Geocoding API
3. Under **Application restrictions**:
   - For development: Use "HTTP referrers" and add `http://localhost:*`
   - For production: Add your domain

### 3. Add API Key to Backend

1. Open `c:\FarmEquipment\loan-intake-backend\.env`
2. Add your API key:
   ```
   GOOGLE_PLACES_API_KEY=AIzaSyC...your_actual_key_here
   ```

### 4. Restart Backend Server

```bash
# Stop Python process
Get-Process python | Stop-Process -Force

# Start backend
cd c:\FarmEquipment\loan-intake-backend
python main.py
```

## Pricing

**Free Tier (per month):**
- Text Search: $0 for first 1,000 requests, then $32 per 1,000
- Place Details: $0 for first 1,000 requests, then $17 per 1,000
- Geocoding: $0 for first 1,000 requests, then $5 per 1,000

**Monthly estimate for moderate use:**
- ~100 dealer searches/day = 3,000 searches/month
- Cost: ~$64-$96/month

**Tips to reduce costs:**
- Cache search results locally
- Limit results to 20 per search (already implemented)
- Use saved dealer info (already implemented with localStorage)

## API Endpoints

### Search Dealers
```
GET http://localhost:8000/dealers/search
Parameters:
  - query: "farm equipment dealer" (default)
  - location: "Des Moines, IA" or "50315"
  - radius: 50000 (meters, default)

Example:
http://localhost:8000/dealers/search?query=John Deere&location=Des Moines, IA
```

### Get Dealer Details
```
GET http://localhost:8000/dealers/details/{place_id}

Returns full details including phone, website, hours, reviews
```

### Search Nearby (by coordinates)
```
GET http://localhost:8000/dealers/nearby?lat=41.5868&lng=-93.6250&radius=25000
```

## Frontend Usage

The dealer search is integrated into the "Dealer Information" step:

1. User enters dealer name/type and location
2. Click "Search" to find nearby dealers
3. Click on a result to auto-fill dealer information
4. All fields remain editable
5. Information saves to localStorage for next time

## Testing Without API Key

If you don't have an API key yet:
- Search will show error message
- Users can still enter dealer info manually
- Saved dealer info still works from localStorage

## Alternative Options

If Google Places is too expensive:

1. **Local Database**: Import CSV of known dealers
2. **Yelp Fusion API**: Cheaper, US-focused (5,000 free calls/day)
3. **Manual Entry Only**: Remove search, rely on localStorage

## Support

For issues:
- Check `.env` file has correct API key
- Verify APIs are enabled in Google Cloud Console
- Check backend terminal for error messages
- Review billing/usage in Google Cloud Console
