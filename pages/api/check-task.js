const endpointMap = {
  'kling-2.6-std': 'kling-v2-6-motion-control-std',
  'kling-2.6-pro': 'kling-v2-6-motion-control-pro',
  'kling-3-std': 'kling-v3-motion-control-std',
  'kling-3-pro': 'kling-v3-motion-control-pro',
};

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method tidak boleh' });
  }

  try {
    const { apiKey, model, taskId } = request.body;

    if (!apiKey || !taskId) {
      return response.status(400).json({
        error: 'API key dan task ID wajib ada',
      });
    }

    const endpoint = endpointMap[model];

    if (!endpoint) {
      return response.status(400).json({ error: 'Model tidak valid' });
    }

    let pollUrl;

    if (model === 'kling-3-std') {
      pollUrl = `https://api.magnific.com/v1/ai/video/kling-v3-motion-control-std/${taskId}`;
    } else if (model === 'kling-3-pro') {
      pollUrl = `https://api.magnific.com/v1/ai/video/kling-v3-motion-control-pro/${taskId}`;
    } else {
      pollUrl = `https://api.magnific.com/v1/ai/image-to-video/kling-v2-6/${taskId}`;
    }

    const magnificResponse = await fetch(pollUrl, {
      method: 'GET',
      headers: {
        'x-magnific-api-key': apiKey,
      },
    });

    const data = await magnificResponse.json().catch(() => ({}));

    if (!magnificResponse.ok) {
      return response.status(magnificResponse.status).json({
        error: data.message || data.error || 'Gagal cek status Magnific',
        detail: data,
      });
    }

    console.log('MAGNIFIC POLL RESPONSE:', JSON.stringify(data, null, 2));

    return response.status(200).json(data);
  } catch (error) {
    return response.status(500).json({
      error: error.message || 'Gagal cek task',
    });
  }
}