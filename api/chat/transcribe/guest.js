// Mock API for guest transcription - will be replaced with real backend
export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Mock transcription response
  const mockTranscriptions = [
    "Hello, can you help me plan a date?",
    "I want to go to a nice restaurant",
    "What about Italian food?",
    "That sounds perfect",
    "Tell me more about Tokyo",
    "I love traveling"
  ];

  const randomTranscription = mockTranscriptions[Math.floor(Math.random() * mockTranscriptions.length)];

  res.json({
    transcript: randomTranscription,
    confidence: 0.95,
    is_guest: true
  });
}
