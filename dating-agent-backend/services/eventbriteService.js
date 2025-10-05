const axios = require('axios');

class EventbriteService {
  constructor() {
    this.apiKey = process.env.EVENTBRITE_API_KEY;
    this.baseURL = 'https://www.eventbriteapi.com/v3';
  }

  async searchEvents(location, radius = 10, categories = []) {
    try {
      if (!this.apiKey) {
        console.warn('EVENTBRITE_API_KEY not found');
        return [];
      }

      console.log(`🎫 Searching Eventbrite for events in ${location} within ${radius} miles`);

      // Eventbrite API v3 has limited public event search capabilities
      // The API is primarily designed for managing your own events
      // We'll try to access public events through alternative means
      
      try {
        // Try to get events from the user's account first
        const userResponse = await axios.get(`${this.baseURL}/users/me/`, {
          headers: { 'Authorization': `Bearer ${this.apiKey}` },
          timeout: 5000
        });
        
        const userId = userResponse.data.id;
        console.log(`🎫 Found user ID: ${userId}`);
        
        // Try to get events associated with this user
        const eventsResponse = await axios.get(`${this.baseURL}/users/${userId}/events/`, {
          headers: { 'Authorization': `Bearer ${this.apiKey}` },
          timeout: 5000
        });
        
        const events = eventsResponse.data.events || [];
        console.log(`🎫 Found ${events.length} user events from Eventbrite`);
        
        // Filter events by location and date if we have them
        const filteredEvents = this.filterEventsByLocation(events, location, radius);
        
        return this.formatEvents(filteredEvents);
        
      } catch (userError) {
        console.log('🎫 Could not access user events, trying public event discovery...');
        
        // Since Eventbrite API v3 doesn't have a public event search endpoint,
        // we'll return a limited set of curated events for popular locations
        return this.getCuratedEvents(location, radius, categories);
      }

    } catch (error) {
      console.error('❌ Eventbrite API error:', error.response?.data || error.message);
      console.log('🎫 Eventbrite integration will be skipped - Ticketmaster will provide events');
      return [];
    }
  }

  formatEvents(events) {
    return events.map(event => {
      const venue = event.venue || {};
      const startDate = new Date(event.start?.local || event.start?.utc);
      
      return {
        id: event.id,
        name: event.name?.text || 'Untitled Event',
        description: this.cleanDescription(event.description?.text || ''),
        date: startDate.toLocaleDateString(),
        time: startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        location: venue.name || event.venue_id,
        address: this.formatAddress(venue),
        category: this.mapCategory(event.category_id),
        cost: this.formatCost(event),
        url: event.url,
        image: event.logo?.url,
        capacity: event.capacity,
        status: event.status,
        is_free: event.is_free,
        currency: event.currency || 'USD'
      };
    });
  }

  cleanDescription(description) {
    // Remove HTML tags and limit length
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
    if (venue.address?.address_1) parts.push(venue.address.address_1);
    if (venue.address?.address_2) parts.push(venue.address.address_2);
    if (venue.address?.city) parts.push(venue.address.city);
    if (venue.address?.region) parts.push(venue.address.region);
    
    return parts.join(', ');
  }

  formatCost(event) {
    if (event.is_free) return 'Free';
    
    const ticketClasses = event.ticket_availability?.ticket_classes || [];
    if (ticketClasses.length === 0) return 'Price varies';
    
    const prices = ticketClasses
      .filter(tc => tc.cost)
      .map(tc => `${tc.cost.currency || 'USD'} ${tc.cost.value || tc.cost.display}`)
      .filter(Boolean);
    
    if (prices.length === 0) return 'Price varies';
    
    // Return price range if multiple prices
    if (prices.length > 1) {
      const sortedPrices = prices.sort();
      return `${sortedPrices[0]} - ${sortedPrices[sortedPrices.length - 1]}`;
    }
    
    return prices[0];
  }

  mapCategory(categoryId) {
    const categories = {
      '103': 'Music',
      '105': 'Business',
      '110': 'Food & Drink',
      '113': 'Community',
      '116': 'Arts',
      '119': 'Film & Media',
      '120': 'Sports & Fitness',
      '122': 'Health',
      '123': 'Science & Technology',
      '124': 'Travel & Outdoor',
      '125': 'Charity & Causes',
      '126': 'Religion & Spirituality',
      '127': 'Family & Education',
      '128': 'Seasonal & Holiday',
      '129': 'Government & Politics',
      '130': 'Fashion & Beauty',
      '131': 'Home & Lifestyle',
      '132': 'Auto, Boat & Air',
      '133': 'Hobbies',
      '134': 'School Activities',
      '135': 'Other'
    };
    
    return categories[categoryId] || 'Other';
  }

  async getEventCategories() {
    try {
      const response = await axios.get(`${this.baseURL}/categories/`, {
        params: { token: this.apiKey },
        timeout: 5000
      });
      
      return response.data.categories || [];
    } catch (error) {
      console.error('❌ Error fetching Eventbrite categories:', error.message);
      return [];
    }
  }

  filterEventsByLocation(events, location, radius) {
    // Simple location filtering - in a real implementation, you'd use geocoding
    // For now, we'll return events that are likely in the same city/region
    const locationLower = location.toLowerCase();
    const cityKeywords = locationLower.split(/[,\s]+/);
    
    return events.filter(event => {
      const eventLocation = (event.venue?.name || '').toLowerCase();
      const eventAddress = (event.venue?.address?.city || '').toLowerCase();
      
      return cityKeywords.some(keyword => 
        keyword.length > 2 && (
          eventLocation.includes(keyword) || 
          eventAddress.includes(keyword)
        )
      );
    });
  }

  getCuratedEvents(location, radius, categories) {
    // Since Eventbrite API v3 doesn't support public event search,
    // we'll provide curated event suggestions based on the location
    // This is a fallback solution when the API doesn't work as expected
    
    console.log('🎫 Providing curated event suggestions for', location);
    
    // Return empty array for now - the main event discovery will come from Ticketmaster
    // In a production app, you might want to maintain a curated list of popular events
    // or integrate with other event discovery services
    
    return [];
  }
}

module.exports = new EventbriteService();
