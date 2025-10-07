// TEST ON LOCALHOST:3000 UNTIL IT WORKS
const puppeteer = require('puppeteer');

async function testLocalhost3000() {
  console.log('🔥 TESTING LOCALHOST:3000 UNTIL IT WORKS');
  console.log('========================================');

  let browser;
  try {
    browser = await puppeteer.launch({ 
      headless: false, 
      devtools: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Enable console logging
    page.on('console', msg => {
      console.log(`🖥️  ${msg.type().toUpperCase()}: ${msg.text()}`);
    });

    console.log('\n1️⃣ NAVIGATING TO LOCALHOST:3000/AI-CHAT...');
    await page.goto('http://localhost:3000/ai-chat', { waitUntil: 'networkidle0' });
    console.log('✅ Connected to localhost:3000/ai-chat');

    console.log('\n2️⃣ LOGGING IN...');
    // Try to find login button with different selectors
    const loginSelectors = [
      'button',
      'a',
      '[class*="login"]',
      '[class*="sign"]',
      '[class*="auth"]'
    ];
    
    let loginButton = null;
    for (const selector of loginSelectors) {
      try {
        const elements = await page.$$(selector);
        for (const element of elements) {
          const text = await page.evaluate(el => el.textContent, element);
          if (text && (text.toLowerCase().includes('sign in') || text.toLowerCase().includes('login'))) {
            loginButton = element;
            console.log(`✅ Found login button with text: ${text}`);
            break;
          }
        }
        if (loginButton) break;
      } catch (error) {
        console.log(`❌ Selector ${selector} failed`);
      }
    }
    
    if (loginButton) {
      await loginButton.click();
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Fill login form
      await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 5000 });
      await page.type('input[type="email"], input[name="email"]', 'afsarijustin@gmail.com');
      await page.type('input[type="password"], input[name="password"]', 'Loserhihi1!');
      
      // Submit login
      await page.click('button[type="submit"]');
      await new Promise(resolve => setTimeout(resolve, 3000));
      console.log('✅ Logged in');
    } else {
      console.log('❌ No login button found, trying direct login');
      // Try to navigate to login page directly
      await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' });
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Fill login form
      await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 5000 });
      await page.type('input[type="email"], input[name="email"]', 'afsarijustin@gmail.com');
      await page.type('input[type="password"], input[name="password"]', 'Loserhihi1!');
      
      // Submit login
      await page.click('button[type="submit"]');
      await new Promise(resolve => setTimeout(resolve, 3000));
      console.log('✅ Logged in via direct login page');
    }

    console.log('\n3️⃣ SETTING PARTNER PROFILE...');
    await page.evaluate(() => {
      localStorage.setItem('partner-profile', JSON.stringify({
        name: 'Christine',
        interests: ['John Summit', 'raves', 'electronic music'],
        age: 28,
        location: 'New York, NY',
        budget: '$$',
        dietaryRestrictions: [],
        neighborhood: 'SoHo',
        travel_radius: 3
      }));
      console.log('✅ Partner profile set in localStorage');
    });

    console.log('\n4️⃣ CHECKING AUTHENTICATION STATUS...');
    const authStatus = await page.evaluate(() => {
      const token = localStorage.getItem('token');
      const user = localStorage.getItem('user');
      console.log('🔍 Token:', token ? 'Present' : 'Missing');
      console.log('🔍 User:', user ? 'Present' : 'Missing');
      return { token: !!token, user: !!user };
    });
    console.log('🔍 Auth status:', authStatus);
    
    if (!authStatus.token) {
      console.log('❌ No token found, login may have failed');
      // Try to get the current URL to see where we are
      const currentUrl = page.url();
      console.log('🔍 Current URL:', currentUrl);
    }

    console.log('\n5️⃣ REFRESHING PAGE...');
    await page.reload({ waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('\n6️⃣ FINDING CHAT INPUT...');
    // Try multiple selectors for chat input
    const chatSelectors = [
      'input[placeholder*="message"]',
      'textarea[placeholder*="message"]',
      'input[type="text"]',
      'textarea',
      '.chat-input input',
      '.chat-input textarea',
      '[class*="input"] input',
      '[class*="input"] textarea'
    ];

    let chatInput = null;
    for (const selector of chatSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 2000 });
        chatInput = selector;
        console.log(`✅ Found chat input with selector: ${selector}`);
        break;
      } catch (error) {
        console.log(`❌ Selector ${selector} not found`);
      }
    }

    if (!chatInput) {
      console.log('❌ No chat input found, trying to find any input');
      const inputs = await page.$$('input, textarea');
      console.log(`Found ${inputs.length} input elements`);
      if (inputs.length > 0) {
        chatInput = 'input, textarea';
      }
    }

    if (!chatInput) {
      throw new Error('No chat input found');
    }

    console.log('\n7️⃣ TYPING MESSAGE...');
    await page.click(chatInput);
    await page.type(chatInput, 'What is christine like');
    console.log('✅ Message typed');

    console.log('\n8️⃣ SENDING MESSAGE...');
    await page.keyboard.press('Enter');
    console.log('✅ Message sent');

    console.log('\n9️⃣ WAITING FOR RESPONSE...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('\n🔟 CHECKING RESPONSE...');
    const response = await page.evaluate(() => {
      // Try multiple selectors for chat messages
      const messageSelectors = [
        '.message',
        '.chat-message',
        '[class*="message"]',
        '.response',
        '.ai-response',
        '[class*="response"]',
        '.conversation .message',
        '.chat .message'
      ];

      for (const selector of messageSelectors) {
        const messages = document.querySelectorAll(selector);
        if (messages.length > 0) {
          const lastMessage = messages[messages.length - 1];
          const text = lastMessage.textContent || lastMessage.innerText;
          if (text && text.length > 10) {
            return { text, selector };
          }
        }
      }

      // Fallback: get all text content
      const allText = document.body.textContent;
      const lines = allText.split('\n').filter(line => line.trim().length > 10);
      const lastLine = lines[lines.length - 1];
      
      return { text: lastLine, selector: 'fallback' };
    });
    
    console.log('📝 Response found:', response);
    
    // Check if response mentions Christine or her interests
    const responseText = response.text.toLowerCase();
    const mentionsChristine = responseText.includes('christine');
    const mentionsJohnSummit = responseText.includes('john summit');
    const mentionsRave = responseText.includes('rave');
    const mentionsElectronic = responseText.includes('electronic');
    
    console.log('\n🔍 ANALYSIS:');
    console.log('Response text:', response.text);
    console.log('Mentions Christine:', mentionsChristine);
    console.log('Mentions John Summit:', mentionsJohnSummit);
    console.log('Mentions Rave:', mentionsRave);
    console.log('Mentions Electronic:', mentionsElectronic);

    if (mentionsChristine && (mentionsJohnSummit || mentionsRave || mentionsElectronic)) {
      console.log('🎉 SUCCESS: AI is using partner profile correctly!');
      console.log('✅ The fix is working!');
    } else {
      console.log('❌ FAILURE: AI is not using partner profile properly');
      console.log('Response:', response.text);
      
      // Try again with a different message
      console.log('\n1️⃣1️⃣ TRYING AGAIN WITH DIFFERENT MESSAGE...');
      await page.click(chatInput);
      await page.evaluate((selector) => {
        const input = document.querySelector(selector);
        if (input) {
          input.value = '';
        }
      }, chatInput);
      await page.type(chatInput, 'Plan me a date with christine');
      await page.keyboard.press('Enter');
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const response2 = await page.evaluate(() => {
        const messageSelectors = [
          '.message',
          '.chat-message',
          '[class*="message"]',
          '.response',
          '.ai-response',
          '[class*="response"]'
        ];

        for (const selector of messageSelectors) {
          const messages = document.querySelectorAll(selector);
          if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            const text = lastMessage.textContent || lastMessage.innerText;
            if (text && text.length > 10) {
              return text;
            }
          }
        }
        return 'No response found';
      });
      
      console.log('📝 Second response:', response2);
      
      const response2Text = response2.toLowerCase();
      const mentionsChristine2 = response2Text.includes('christine');
      const mentionsJohnSummit2 = response2Text.includes('john summit');
      const mentionsRave2 = response2Text.includes('rave');
      
      if (mentionsChristine2 && (mentionsJohnSummit2 || mentionsRave2)) {
        console.log('🎉 SUCCESS: AI is using partner profile correctly on second try!');
      } else {
        console.log('❌ STILL FAILING: AI is not using partner profile properly');
        console.log('Second response:', response2);
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testLocalhost3000();
