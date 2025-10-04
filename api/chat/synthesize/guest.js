// Mock API for guest synthesis - will be replaced with real backend
export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text } = req.body;

  if (!text) {
    return res.status(400).json({
      error: 'Text is required',
      code: 'MISSING_TEXT'
    });
  }

  // Mock audio response (empty base64 for now)
  const mockAudio = Buffer.from('mock audio data').toString('base64');

  res.json({
    audio: mockAudio,
    format: 'wav',
    is_guest: true
  });
}
