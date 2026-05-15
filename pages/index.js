import { useState, useRef } from 'react';
import { upload } from '@vercel/blob/client';
import {
  Bot,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Video,
  UploadCloud,
  CheckCircle2,
  Zap,
  Wand2,
  Play,
  XCircle,
} from 'lucide-react';

export default function Home() {
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  const [model, setModel] = useState('kling-2.6-std');

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);

  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);

  const [prompt, setPrompt] = useState('');
  const [orientation, setOrientation] = useState('kompleks');
  const [cfgScale, setCfgScale] = useState(0.5);

  const [isGenerating, setIsGenerating] = useState(false);
  const [notification, setNotification] = useState({
    show: false,
    message: '',
    type: '',
  });
  const [resultVideo, setResultVideo] = useState(null);

  const showNotification = (message, type = 'info') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: '', type: '' });
    }, 5000);
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showNotification('Foto maksimal 10MB, cuy.', 'error');
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleVideoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      showNotification('Video maksimal 25MB, cuy.', 'error');
      return;
    }

    const tempVideo = document.createElement('video');
    tempVideo.preload = 'metadata';

    tempVideo.onloadedmetadata = () => {
      URL.revokeObjectURL(tempVideo.src);

      if (tempVideo.duration > 30) {
        showNotification('Video maksimal 30 detik, cuy.', 'error');
        return;
      }

      setVideoFile(file);
      setVideoPreview(URL.createObjectURL(file));
    };

    tempVideo.src = URL.createObjectURL(file);
  };

  const handleGenerate = async () => {
    if (!apiKey) {
      showNotification('API Key wajib diisi dulu.', 'error');
      return;
    }

    if (!imageFile) {
      showNotification('Foto karakter wajib diupload dulu.', 'error');
      return;
    }

    if (!videoFile) {
      showNotification('Video referensi wajib diupload dulu.', 'error');
      return;
    }

    setIsGenerating(true);
    setResultVideo(null);

    try {
      showNotification('Upload foto ke server...', 'info');

      const uploadedImage = await upload(imageFile.name, imageFile, {
        access: 'public',
        handleUploadUrl: '/api/upload',
      });

      showNotification('Upload video ke server...', 'info');

      const uploadedVideo = await upload(videoFile.name, videoFile, {
        access: 'public',
        handleUploadUrl: '/api/upload',
      });

      showNotification('Ngirim tugas ke Magnific...', 'info');

      const createResponse = await fetch('/api/create-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          model,
          imageUrl: uploadedImage.url,
          videoUrl: uploadedVideo.url,
          prompt,
          orientation,
          cfgScale,
        }),
      });

      const createData = await createResponse.json();

      if (!createResponse.ok) {
        throw new Error(createData.error || 'Gagal bikin task.');
      }

      const taskId = createData.taskId;

      showNotification('Task masuk antrean. Nunggu hasil video...', 'info');

      const poll = async () => {
        const pollResponse = await fetch('/api/check-task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey,
            model,
            taskId,
          }),
        });

        const pollData = await pollResponse.json();

        if (!pollResponse.ok) {
          throw new Error(pollData.error || 'Gagal cek status.');
        }

        const status = pollData.status;

        if (
          status === 'completed' ||
          status === 'succeeded' ||
          status === 'success'
        ) {
          const videoUrl =
            pollData.video_url ||
            pollData.output_url ||
            pollData.result_url ||
            pollData.url ||
            pollData.output?.video_url ||
            pollData.result?.video_url;

          if (!videoUrl) {
            throw new Error('Selesai, tapi link video tidak ketemu.');
          }

          setResultVideo(videoUrl);
          setIsGenerating(false);
          showNotification('Video berhasil dibuat!', 'success');
          return;
        }

        if (status === 'failed' || status === 'error') {
          setIsGenerating(false);
          showNotification('Render gagal di Magnific.', 'error');
          return;
        }

        setTimeout(poll, 5000);
      };

      setTimeout(poll, 5000);
    } catch (error) {
      setIsGenerating(false);
      showNotification(error.message || 'Ada error.', 'error');
    }
  };

  return (
    <main className="min-h-screen bg-[#0f0e17] text-gray-200 p-4 sm:p-8 flex justify-center">
      <div className="w-full max-w-3xl space-y-8 pb-20">
        {notification.show && (
          <div
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-4 rounded-2xl shadow-2xl border-2 flex items-center gap-3 ${
              notification.type === 'error'
                ? 'bg-[#2a0e0e] border-red-500 text-red-200'
                : notification.type === 'success'
                ? 'bg-[#0e2a14] border-green-500 text-green-200'
                : 'bg-[#16161e] border-[#8b5cf6] text-purple-200'
            }`}
          >
            {notification.type === 'error' && <XCircle size={24} />}
            {notification.type === 'success' && <CheckCircle2 size={24} />}
            {notification.type === 'info' && <Zap size={24} />}
            <span className="font-medium text-sm">{notification.message}</span>
          </div>
        )}

        <section className="text-center space-y-4 pt-8 pb-4">
          <div className="mx-auto w-16 h-16 bg-[#8b5cf6] rounded-2xl flex items-center justify-center shadow-lg">
            <Bot size={32} className="text-white" />
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight">
            JOGETIN <span className="text-[#8b5cf6]">AI</span>
          </h1>
          <p className="text-sm text-gray-400 font-medium">
            Motion control generator BYOK
          </p>
        </section>

        <section className="card">
          <div className="section-title">
            <Zap className="text-[#8b5cf6]" size={22} />
            <h2>Konfigurasi API</h2>
          </div>

          <label className="label">Magnific / Freepik API Key</label>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="Masukkan API Key..."
              className="input pr-14"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            >
              {showApiKey ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <label className="label mt-6">Pilih Model</label>
          <select
            value={model}
            onChange={(event) => setModel(event.target.value)}
            className="input"
          >
            <option value="kling-2.6-std">Kling 2.6 Standard</option>
            <option value="kling-2.6-pro">Kling 2.6 Pro</option>
            <option value="kling-3-std">Kling 3 Standard</option>
            <option value="kling-3-pro">Kling 3 Pro</option>
          </select>
        </section>

        <section className="card">
          <div className="section-title">
            <ImageIcon className="text-[#8b5cf6]" size={22} />
            <h2>Upload Foto & Video</h2>
          </div>

          <div className="upload-box" onClick={() => imageInputRef.current?.click()}>
            {imagePreview ? (
              <img src={imagePreview} className="preview-media" alt="Preview foto" />
            ) : (
              <div className="text-center">
                <UploadCloud size={46} className="mx-auto mb-3 text-gray-500" />
                <p className="font-bold">Klik untuk upload foto karakter</p>
                <p className="text-xs text-gray-500">JPG / PNG / WEBP maksimal 10MB</p>
              </div>
            )}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
          </div>

          {imageFile && <p className="file-name">Foto: {imageFile.name}</p>}

          <div className="upload-box mt-6" onClick={() => videoInputRef.current?.click()}>
            {videoPreview ? (
              <video src={videoPreview} className="preview-media" controls />
            ) : (
              <div className="text-center">
                <Video size={46} className="mx-auto mb-3 text-gray-500" />
                <p className="font-bold">Klik untuk upload video referensi</p>
                <p className="text-xs text-gray-500">MP4 / MOV / WEBM maksimal 25MB, 30 detik</p>
              </div>
            )}
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              onChange={handleVideoChange}
              className="hidden"
            />
          </div>

          {videoFile && <p className="file-name">Video: {videoFile.name}</p>}
        </section>

        <section className="card">
          <div className="section-title">
            <Wand2 className="text-[#8b5cf6]" size={22} />
            <h2>Prompt & Pengaturan</h2>
          </div>

          <label className="label">Deskripsi Gerakan</label>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value.slice(0, 2500))}
            placeholder="Contoh: gerakan tarian santai, senyum, kamera stabil..."
            rows={4}
            className="input resize-none"
          />

          <label className="label mt-6">Tipe Gerakan</label>
          <select
            value={orientation}
            onChange={(event) => setOrientation(event.target.value)}
            className="input"
          >
            <option value="kompleks">Gerakan kompleks sampai 30 detik</option>
            <option value="sederhana">Gerakan sederhana sampai 10 detik</option>
          </select>

          <label className="label mt-6">CFG Scale: {cfgScale}</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={cfgScale}
            onChange={(event) => setCfgScale(parseFloat(event.target.value))}
            className="w-full accent-[#8b5cf6]"
          />
        </section>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full py-7 rounded-[2rem] font-black text-2xl uppercase flex items-center justify-center gap-4 bg-[#8b5cf6] disabled:bg-[#2a1a47] text-white shadow-xl hover:scale-[1.01] active:scale-[0.98] transition"
        >
          <Play fill="currentColor" size={32} />
          {isGenerating ? 'Sedang Memproses...' : 'Mulai Jogetin'}
        </button>

        {resultVideo && (
          <section className="card border-4 border-[#8b5cf6]">
            <div className="section-title">
              <CheckCircle2 className="text-green-500" size={26} />
              <h2>Berhasil Dijogetin!</h2>
            </div>

            <video src={resultVideo} controls autoPlay loop className="w-full rounded-2xl bg-black" />

            <a
              href={resultVideo}
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-6 text-center bg-[#8b5cf6] py-4 rounded-2xl font-black text-white"
            >
              Buka / Download Hasil
            </a>
          </section>
        )}
      </div>
    </main>
  );
}