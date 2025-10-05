const axios = require('axios');

class TicketmasterService {
  constructor() {
    this.consumerKey = process.env.TICKETMASTER_CONSUMER_KEY;
    this.consumerSecret = process.env.TICKETMASTER_CONSUMER_SECRET;
    this.baseURL = 'https://app.ticketmaster.com/discovery/v2';
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  async getAccessToken() {
    try {
      // Check if we have a valid token
      if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
        return this.accessToken;
      }

      if (!this.consumerKey || !this.consumerSecret) {
        throw new Error('Ticketmaster credentials not configured');
      }

      console.log('🎫 Getting Ticketmaster access token...');

      // Get access token using client credentials flow
      const response = await axios.post('https://oauth.ticketmaster.com/oauth/token', 
        `grant_type=client_credentials&client_id=${this.consumerKey}&client_secret=${this.consumerSecret}`, 
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 10000
        }
      );

      this.accessToken = response.data.access_token;
      // Set expiry 5 minutes before actual expiry for safety
      this.tokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000;

      console.log('✅ Ticketmaster access token obtained');
      return this.accessToken;

    } catch (error) {
      console.error('❌ Error getting Ticketmaster access token:', error.response?.data || error.message);
      throw error;
    }
  }

  async searchEvents(location, radius = 10, startDate = null, endDate = null) {
    try {
      if (!this.consumerKey) {
        throw new Error('Ticketmaster API key not configured');
      }
      
      if (!startDate) {
        startDate = new Date();
      }
      if (!endDate) {
        endDate = new Date();
        endDate.setDate(endDate.getDate() + 14); // 2 weeks
      }

      console.log(`🎫 Searching Ticketmaster for events in ${location} within ${radius} miles`);
      console.log(`🎫 Date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

      // Format dates correctly for Ticketmaster
      const formatDateForTicketmaster = (date) => {
        return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
      };

      const params = {
        apikey: this.consumerKey, // Use API key directly
        city: location.split(',')[0].trim(),
        radius: radius,
        unit: 'miles',
        startDateTime: formatDateForTicketmaster(startDate),
        endDateTime: formatDateForTicketmaster(endDate),
        size: 50,
        sort: 'date,asc',
        classificationName: 'Music,Arts & Theatre,Sports,Miscellaneous'
      };

      const response = await axios.get(`${this.baseURL}/events.json`, {
        params,
        timeout: 15000
      });

      const events = response.data._embedded?.events || [];
      console.log(`🎫 Found ${events.length} events from Ticketmaster`);

      return this.formatEvents(events);

    } catch (error) {
      console.error('❌ Ticketmaster API error:', error.response?.data || error.message);
      return [];
    }
  }

  formatEvents(events) {
    return events.map(event => {
      const venue = event._embedded?.venues?.[0];
      const startDate = event.dates?.start?.dateTime ? new Date(event.dates.start.dateTime) : new Date();
      const priceRange = event.priceRanges?.[0];
      
      return {
        id: event.id,
        name: event.name || 'Untitled Event',
        description: this.cleanDescription(event.info || event.description || ''),
        date: startDate.toLocaleDateString(),
        time: startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        location: venue?.name || 'TBA',
        address: this.formatAddress(venue),
        category: this.mapClassification(event.classifications?.[0]),
        cost: this.formatPriceRange(priceRange),
        url: event.url,
        image: event.images?.[0]?.url,
        capacity: venue?.capacity,
        status: event.dates?.status?.code,
        is_free: priceRange?.min === 0 && priceRange?.max === 0,
        currency: priceRange?.currency || 'USD',
        source: 'Ticketmaster'
      };
    });
  }

  cleanDescription(description) {
    if (!description) return '';
    
    return description
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim()
      .substring(0, 200) + '...';
  }

  formatAddress(venue) {
    if (!venue) return '';
    
    const parts = [];
    if (venue.address?.line1) parts.push(venue.address.line1);
    if (venue.address?.line2) parts.push(venue.address.line2);
    if (venue.city?.name) parts.push(venue.city.name);
    if (venue.state?.name) parts.push(venue.state.name);
    
    return parts.join(', ');
  }

  formatPriceRange(priceRange) {
    if (!priceRange) return 'Price varies';
    
    if (priceRange.min === 0 && priceRange.max === 0) return 'Free';
    
    const currency = priceRange.currency || 'USD';
    const min = Math.round(priceRange.min);
    const max = Math.round(priceRange.max);
    
    if (min === max) {
      return `${currency} ${min}`;
    }
    
    return `${currency} ${min} - ${max}`;
  }

  mapClassification(classification) {
    if (!classification) return 'Other';
    
    const primaryGenre = classification.genre?.name;
    const primarySubGenre = classification.subGenre?.name;
    
    if (primaryGenre) {
      const genreMap = {
        'Rock': 'Music',
        'Pop': 'Music', 
        'Hip-Hop': 'Music',
        'Electronic': 'Music',
        'Jazz': 'Music',
        'Country': 'Music',
        'Classical': 'Music',
        'R&B': 'Music',
        'Reggae': 'Music',
        'Alternative': 'Music',
        'Theatre': 'Arts',
        'Comedy': 'Arts',
        'Dance': 'Arts',
        'Classical': 'Arts',
        'Sports': 'Sports',
        'Baseball': 'Sports',
        'Basketball': 'Sports',
        'Football': 'Sports',
        'Hockey': 'Sports',
        'Soccer': 'Sports'
      };
      
      return genreMap[primaryGenre] || primaryGenre;
    }
    
    return 'Other';
  }

  async getEventDetails(eventId) {
    try {
      const accessToken = await this.getAccessToken();
      
      const response = await axios.get(`${this.baseURL}/events/${eventId}.json`, {
        params: { apikey: this.consumerKey },
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        },
        timeout: 10000
      });

      return response.data;

    } catch (error) {
      console.error('❌ Error getting Ticketmaster event details:', error.message);
      return null;
    }
  }
}

module.exports = new TicketmasterService();
