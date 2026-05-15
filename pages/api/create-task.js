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
    const {
      apiKey,
      model,
      imageUrl,
      videoUrl,
      prompt,
      orientation,
      cfgScale,
    } = request.body;

    if (!apiKey) {
      return response.status(400).json({ error: 'API key wajib diisi' });
    }

    if (!imageUrl || !videoUrl) {
      return response.status(400).json({
        error: 'Foto dan video belum berhasil diupload',
      });
    }

    const endpoint = endpointMap[model];

    if (!endpoint) {
      return response.status(400).json({ error: 'Model tidak valid' });
    }

    const createUrl = `https://api.magnific.com/v1/ai/video/${endpoint}`;

    const payload = {
      image_url: imageUrl,
      video_url: videoUrl,
      prompt: prompt || '',
      character_orientation: orientation === 'sederhana' ? 'image' : 'video',
      cfg_scale: Number(cfgScale ?? 0.5),
    };

    const magnificResponse = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-magnific-api-key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    const data = await magnificResponse.json().catch(() => ({}));

    if (!magnificResponse.ok) {
      return response.status(magnificResponse.status).json({
        error: data.message || data.error || 'Magnific menolak request',
        detail: data,
      });
    }

    const taskId = data.id || data.task_id;

    if (!taskId) {
      return response.status(500).json({
        error: 'Task ID tidak ditemukan dari Magnific',
        detail: data,
      });
    }

    return response.status(200).json({
      taskId,
      raw: data,
    });
  } catch (error) {
    return response.status(500).json({
      error: error.message || 'Gagal membuat task',
    });
  }
}