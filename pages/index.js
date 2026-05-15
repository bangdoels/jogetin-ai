import { useState, useRef, useEffect } from 'react';
import { upload } from '@vercel/blob/client';
import {
  Bot,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Video,
  UploadCloud,
  CheckCircle2,
  ChevronDown,
  Zap,
  Wand2,
  Play,
  XCircle,
} from 'lucide-react';

export default function Home() {
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  const [model, setModel] = useState('kling-2.6-std');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);

  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);

  const [prompt, setPrompt] = useState('');
  const [orientation, setOrientation] = useState('kompleks');
  const [isOrientationDropdownOpen, setIsOrientationDropdownOpen] = useState(false);
  const [cfgScale, setCfgScale] = useState(0.5);

  const [isGenerating, setIsGenerating] = useState(false);
  const [notification, setNotification] = useState({
    show: false,
    message: '',
    type: '',
  });
  const [resultVideo, setResultVideo] = useState(null);

  const models = [
    { id: 'kling-2.6-std', name: 'Kling 2.6 Standard', badge: 'STD' },
    { id: 'kling-2.6-pro', name: 'Kling 2.6 Pro', badge: 'PRO' },
    { id: 'kling-3-std', name: 'Kling 3 Standard', badge: 'STD' },
    { id: 'kling-3-pro', name: 'Kling 3 Pro', badge: 'PRO' },
  ];

  const orientations = [
    { id: 'kompleks', name: 'video — gerakan kompleks, s/d 30 dtk' },
    { id: 'sederhana', name: 'image — gerakan sederhana, s/d 10 dtk' },
  ];

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      if (videoPreview) URL.revokeObjectURL(videoPreview);
    };
  }, [imagePreview, videoPreview]);

  const showNotification = (message, type = 'info') => {
    setNotification({ show: true, message, type });

    setTimeout(() => {
      setNotification({ show: false, message: '', type: '' });
    }, 6000);
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showNotification('Foto kegedean, cuy. Maksimal 10MB.', 'error');
      return;
    }

    if (imagePreview) URL.revokeObjectURL(imagePreview);

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleVideoChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      showNotification('Video kegedean, cuy. Maksimal 25MB.', 'error');
      return;
    }

    const videoElement = document.createElement('video');
    videoElement.preload = 'metadata';

    videoElement.onloadedmetadata = () => {
      URL.revokeObjectURL(videoElement.src);

      if (videoElement.duration > 30) {
        showNotification('Durasi video kepanjangan. Maksimal 30 detik.', 'error');
        setVideoFile(null);

        if (videoPreview) URL.revokeObjectURL(videoPreview);
        setVideoPreview(null);

        return;
      }

      if (videoPreview) URL.revokeObjectURL(videoPreview);

      setVideoFile(file);
      setVideoPreview(URL.createObjectURL(file));
    };

    videoElement.onerror = () => {
      showNotification('Video gagal dibaca. Coba file MP4/MOV/WEBM lain.', 'error');
    };

    videoElement.src = URL.createObjectURL(file);
  };

  const handleGenerate = async () => {
    if (!apiKey.trim()) {
      showNotification('API Key wajib diisi dulu.', 'error');
      return;
    }

    if (!imageFile) {
      showNotification('Foto karakter belum diunggah.', 'error');
      return;
    }

    if (!videoFile) {
      showNotification('Video referensi belum diunggah.', 'error');
      return;
    }

    setIsGenerating(true);
    setResultVideo(null);

    try {
      showNotification('Upload foto karakter dulu...', 'info');

      const uploadedImage = await upload(imageFile.name, imageFile, {
        access: 'public',
        handleUploadUrl: '/api/upload',
      });

      showNotification('Upload video referensi...', 'info');

      const uploadedVideo = await upload(videoFile.name, videoFile, {
        access: 'public',
        handleUploadUrl: '/api/upload',
      });

      showNotification('Ngirim task ke Magnific...', 'info');

      const createResponse = await fetch('/api/create-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
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
        throw new Error(createData.error || 'Gagal membuat task.');
      }

      const taskId = createData.taskId;

      if (!taskId) {
        throw new Error('Task ID kosong. Magnific belum ngasih nomor antrean.');
      }

      showNotification('Antrian diterima. Nunggu render video...', 'info');

      const poll = async () => {
        try {
          const pollResponse = await fetch('/api/check-task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              apiKey: apiKey.trim(),
              model,
              taskId,
            }),
          });

          const pollData = await pollResponse.json();

          if (!pollResponse.ok) {
            throw new Error(pollData.error || 'Gagal cek status task.');
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
              pollData.output?.url ||
              pollData.result?.video_url ||
              pollData.result?.url;

            if (!videoUrl) {
              throw new Error('Render selesai, tapi link video nggak ketemu.');
            }

            setResultVideo(videoUrl);
            setIsGenerating(false);
            showNotification('Video berhasil dibuat!', 'success');
            return;
          }

          if (status === 'failed' || status === 'error') {
            setIsGenerating(false);
            showNotification('Render gagal di server Magnific.', 'error');
            return;
          }

          setTimeout(poll, 5000);
        } catch (error) {
          setIsGenerating(false);
          showNotification(error.message || 'Polling error.', 'error');
        }
      };

      setTimeout(poll, 5000);
    } catch (error) {
      setIsGenerating(false);
      showNotification(error.message || 'Ada error pas generate.', 'error');
    }
  };

  const selectedModel = models.find((item) => item.id === model);
  const selectedOrientation = orientations.find((item) => item.id === orientation);

  return (
    <>
      <main className="page">
        <div className="container">
          {notification.show && (
            <div className={`notification notification-${notification.type}`}>
              {notification.type === 'error' && <XCircle size={24} />}
              {notification.type === 'success' && <CheckCircle2 size={24} />}
              {notification.type === 'info' && <Zap size={24} />}
              <span>{notification.message}</span>
            </div>
          )}

          <header className="header">
            <div className="logo">
              <Bot size={34} color="white" strokeWidth={2.5} />
            </div>

            <div className="header-copy">
              <h1>
                JOGETIN <span>AI</span>
              </h1>

              <p>Generator gerakan motion control cepat untuk karakter dan referensi video kamu.</p>

              <div className="hero-note">
                <span>Final UI</span>
                <p>Desain rapi, pengalaman upload halus, dan hasil siap download dengan satu sentuhan.</p>
              </div>
            </div>
          </header>

          <section className="card">
            <div className="card-head split">
              <div className="card-title">
                <Zap size={22} />
                <h2>Konfigurasi API</h2>
              </div>

              <div className="byok-pill">
                <CheckCircle2 size={16} />
                <span>BYOK Mode</span>
              </div>
            </div>

            <div className="field">
              <label>Magnific / Freepik API Key</label>

              <div className="input-wrap">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder="Masukkan API Key Anda..."
                />

                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  aria-label="Toggle API key"
                >
                  {showApiKey ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div className="field dropdown-field">
              <label>Pilih Model</label>

              <button
                type="button"
                className="dropdown-trigger"
                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
              >
                <div className="dropdown-main">
                  <strong>{selectedModel?.name}</strong>
                  <small>{selectedModel?.badge}</small>
                </div>

                <ChevronDown
                  size={20}
                  className={isModelDropdownOpen ? 'rotate' : ''}
                />
              </button>

              {isModelDropdownOpen && (
                <div className="dropdown-menu">
                  {models.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={`dropdown-item ${model === item.id ? 'active' : ''}`}
                      onClick={() => {
                        setModel(item.id);
                        setIsModelDropdownOpen(false);
                      }}
                    >
                      <div>
                        <strong>{item.name}</strong>
                        <small>{item.badge}</small>
                      </div>

                      {model === item.id && <CheckCircle2 size={18} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <div className="card-title">
                <ImageIcon size={22} />
                <h2>Unggah & Pratinjau</h2>
              </div>
            </div>

            <div className="upload-card">
              <div className="upload-top">
                <div className="upload-title">
                  <div className="mini-icon">
                    <ImageIcon size={18} />
                  </div>

                  <div>
                    <h3>Foto Karakter Utama</h3>
                    <p>{imageFile ? imageFile.name : 'Pilih File Gambar'}</p>
                  </div>
                </div>

                {imageFile && <CheckCircle2 className="check" size={22} />}
              </div>

              <div
                className="upload-box"
                onClick={() => imageInputRef.current?.click()}
              >
                {imagePreview ? (
                  <>
                    <img src={imagePreview} alt="Preview" />
                    <div className="hover-layer">
                      <span>GANTI FOTO</span>
                    </div>
                  </>
                ) : (
                  <div className="empty-state">
                    <UploadCloud size={48} />
                    <strong>Pilih foto dari perangkat</strong>
                    <small>JPG / PNG / WEBP, maks 10 MB</small>
                  </div>
                )}

                <input
                  type="file"
                  ref={imageInputRef}
                  onChange={handleImageChange}
                  accept="image/*"
                  hidden
                />
              </div>
            </div>

            <div className="upload-card">
              <div className="upload-top">
                <div className="upload-title">
                  <div className="mini-icon">
                    <Video size={18} />
                  </div>

                  <div>
                    <h3>Video Referensi Gerak</h3>
                    <p>{videoFile ? videoFile.name : 'Pilih File Video'}</p>
                  </div>
                </div>

                {videoFile && <CheckCircle2 className="check" size={22} />}
              </div>

              <div
                className="upload-box"
                onClick={(event) => {
                  if (videoPreview && event.target.tagName === 'VIDEO') return;
                  videoInputRef.current?.click();
                }}
              >
                {videoPreview ? (
                  <>
                    <video src={videoPreview} controls />
                    <button
                      type="button"
                      className="replace-video"
                      onClick={(event) => {
                        event.stopPropagation();
                        videoInputRef.current?.click();
                      }}
                    >
                      GANTI VIDEO
                    </button>
                  </>
                ) : (
                  <div className="empty-state">
                    <UploadCloud size={48} />
                    <strong>Pilih video dari perangkat</strong>
                    <small>Maks 25 MB, 30 dtk, MP4/MOV/WEBM</small>
                  </div>
                )}

                <input
                  type="file"
                  ref={videoInputRef}
                  onChange={handleVideoChange}
                  accept="video/*"
                  hidden
                />
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <div className="card-title">
                <Wand2 size={22} />
                <h2>Prompt & Pengaturan</h2>
              </div>
            </div>

            <div className="field">
              <label>Deskripsi Gerakan</label>

              <div className="textarea-wrap">
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value.slice(0, 2500))}
                  placeholder="Misal: gerakan tarian pargoy perlahan dengan senyuman..."
                  rows={4}
                />

                <span>{prompt.length}/2500</span>
              </div>
            </div>

            <div className="settings-grid">
              <div className="field dropdown-field">
                <label>Orientasi Karakter</label>

                <button
                  type="button"
                  className="dropdown-trigger"
                  onClick={() =>
                    setIsOrientationDropdownOpen(!isOrientationDropdownOpen)
                  }
                >
                  <div className="dropdown-main">
                    <strong>{selectedOrientation?.name}</strong>
                  </div>

                  <ChevronDown
                    size={20}
                    className={isOrientationDropdownOpen ? 'rotate' : ''}
                  />
                </button>

                {isOrientationDropdownOpen && (
                  <div className="dropdown-menu">
                    {orientations.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        className={`dropdown-item ${
                          orientation === item.id ? 'active' : ''
                        }`}
                        onClick={() => {
                          setOrientation(item.id);
                          setIsOrientationDropdownOpen(false);
                        }}
                      >
                        <div>
                          <strong>{item.name}</strong>
                        </div>

                        {orientation === item.id && <CheckCircle2 size={18} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="field">
                <div className="range-head">
                  <label>CFG Scale / Presisi</label>
                  <strong>{cfgScale.toFixed(1)}</strong>
                </div>

                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={cfgScale}
                  onChange={(event) => setCfgScale(parseFloat(event.target.value))}
                  className="range"
                  style={{
                    background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${
                      cfgScale * 100
                    }%, #3b3b4f ${cfgScale * 100}%, #3b3b4f 100%)`,
                  }}
                />
              </div>
            </div>
          </section>

          <button
            type="button"
            className={`generate-button ${isGenerating ? 'loading' : ''}`}
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <span className="spinner" />
                <span>SEDANG MEMPROSES...</span>
              </>
            ) : (
              <>
                <Play fill="currentColor" size={36} />
                <span>MULAI JOGETIN!</span>
              </>
            )}
          </button>

          {resultVideo && (
            <section className="result-card">
              <div className="result-head">
                <div>
                  <Zap size={32} />
                  <h2>BERHASIL DIJOGETIN!</h2>
                </div>

                <CheckCircle2 size={32} />
              </div>

              <div className="result-video-wrap">
                <video src={resultVideo} controls autoPlay loop />
              </div>

              <a
                href={resultVideo}
                target="_blank"
                rel="noopener noreferrer"
                className="download-button"
              >
                UNDUH HASIL JOGET
              </a>
            </section>
          )}
        </div>
      </main>

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        html,
        body,
        #__next {
          margin: 0;
          min-height: 100%;
          background: #0f0e17;
          color: #e5e7eb;
          font-family: Arial, Helvetica, sans-serif;
        }

        body {
          overflow-x: hidden;
        }

        button,
        input,
        textarea {
          font-family: inherit;
        }

        button {
          border: 0;
        }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top left, rgba(139, 92, 246, 0.22), transparent 26rem),
            radial-gradient(circle at bottom right, rgba(14, 165, 233, 0.16), transparent 26rem),
            linear-gradient(180deg, #0f0e17 0%, #09080f 100%);
          padding: 40px 18px 84px;
          display: flex;
          justify-content: center;
        }

        .container {
          width: 100%;
          max-width: 820px;
          position: relative;
        }

        .notification {
          position: fixed;
          top: 18px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 999;
          padding: 16px 22px;
          border-radius: 18px;
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 14px;
          font-weight: 800;
          border: 2px solid #8b5cf6;
          background: #16161e;
          color: #ddd6fe;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
          max-width: calc(100vw - 32px);
        }

        .notification-error {
          border-color: #ef4444;
          background: #2a0e0e;
          color: #fecaca;
        }

        .notification-success {
          border-color: #22c55e;
          background: #0e2a14;
          color: #bbf7d0;
        }

        .header {
          max-width: 760px;
          margin: 0 auto;
          text-align: center;
          padding: 28px 0 14px;
        }

        .header-copy {
          display: flex;
          flex-direction: column;
          gap: 18px;
          align-items: center;
        }

        .logo {
          width: 72px;
          height: 72px;
          margin: 0 auto;
          background: linear-gradient(135deg, #a855f7, #7c3aed);
          border-radius: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 34px rgba(139, 92, 246, 0.36);
          transition: transform 0.25s ease;
        }

        .logo:hover {
          transform: scale(1.08) rotate(8deg);
        }

        .header h1 {
          margin: 20px 0 0;
          color: white;
          font-size: clamp(40px, 7vw, 70px);
          line-height: 1.02;
          font-weight: 950;
          letter-spacing: -0.06em;
        }

        .header h1 span {
          color: #a855f7;
        }

        .header p {
          margin: 18px 0 0;
          color: #c7d2fe;
          font-size: 16px;
          font-weight: 600;
          max-width: 620px;
        }

        .hero-note {
          display: inline-flex;
          flex-direction: column;
          gap: 6px;
          margin-top: 14px;
          padding: 18px 22px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(139, 92, 246, 0.18);
          border-radius: 24px;
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.02);
          color: #d1d5db;
          text-align: center;
          max-width: 680px;
        }

        .hero-note span {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 8px 14px;
          border-radius: 999px;
          background: rgba(139, 92, 246, 0.16);
          color: #e9d5ff;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .hero-note p {
          margin: 0;
          color: #c7d2fe;
          font-size: 14px;
          line-height: 1.7;
        }

        .card,
        .result-card {
          background: rgba(14, 13, 25, 0.96);
          border: 1px solid rgba(139, 92, 246, 0.18);
          border-radius: 32px;
          padding: 30px;
          margin-top: 28px;
          box-shadow: 0 32px 90px rgba(0, 0, 0, 0.26);
          position: relative;
          overflow: visible;
        }

        .card-head {
          padding-bottom: 18px;
          margin-bottom: 24px;
          border-bottom: 1px solid #2a2a35;
        }

        .card-head.split {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .card-title {
          display: flex;
          align-items: center;
          gap: 12px;
          color: white;
        }

        .card-title svg {
          color: #8b5cf6;
        }

        .card-title h2 {
          margin: 0;
          font-size: 22px;
          font-weight: 900;
        }

        .byok-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          border: 1px solid rgba(139, 92, 246, 0.35);
          background: #1a1a24;
          color: #c4b5fd;
          border-radius: 999px;
          padding: 9px 12px;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          white-space: nowrap;
        }

        .field {
          margin-top: 22px;
        }

        .field:first-of-type {
          margin-top: 0;
        }

        .field label {
          display: block;
          margin-bottom: 10px;
          color: #6b7280;
          font-size: 11px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .input-wrap {
          position: relative;
        }

        input,
        textarea,
        .dropdown-trigger {
          width: 100%;
          background: #1f1f2e;
          border: 2px solid #3b3b4f;
          border-radius: 18px;
          color: white;
          outline: none;
          transition: border-color 0.2s, background 0.2s;
        }

        input {
          padding: 16px 54px 16px 18px;
          font-size: 14px;
        }

        textarea {
          padding: 16px 18px;
          min-height: 124px;
          resize: none;
          font-size: 14px;
          line-height: 1.6;
        }

        input:focus,
        textarea:focus,
        .dropdown-trigger:hover {
          border-color: #8b5cf6;
        }

        .icon-button {
          position: absolute;
          right: 16px;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          color: #6b7280;
          cursor: pointer;
          padding: 6px;
        }

        .icon-button:hover {
          color: white;
        }

        .dropdown-field {
          position: relative;
        }

        .dropdown-trigger {
          padding: 16px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          text-align: left;
        }

        .dropdown-main {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .dropdown-main strong {
          font-size: 15px;
          color: white;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .dropdown-main small {
          background: #2a2a35;
          border: 1px solid #3b3b4f;
          color: #d1d5db;
          border-radius: 8px;
          font-size: 10px;
          font-weight: 900;
          padding: 3px 8px;
        }

        .rotate {
          transform: rotate(180deg);
        }

        .dropdown-menu {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          right: 0;
          z-index: 50;
          background: #1f1f2e;
          border: 2px solid #3b3b4f;
          border-radius: 18px;
          overflow: hidden;
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.45);
        }

        .dropdown-item {
          width: 100%;
          background: transparent;
          color: white;
          padding: 16px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          border-bottom: 1px solid #2a2a35;
          text-align: left;
        }

        .dropdown-item:last-child {
          border-bottom: 0;
        }

        .dropdown-item:hover {
          background: #2a2a35;
        }

        .dropdown-item.active strong,
        .dropdown-item.active svg {
          color: #8b5cf6;
        }

        .dropdown-item strong {
          display: block;
          font-size: 14px;
        }

        .dropdown-item small {
          display: inline-block;
          margin-top: 6px;
          color: #9ca3af;
          font-size: 10px;
          font-weight: 900;
        }

        .upload-card {
          background: #1a1a24;
          border: 1px solid #3b3b4f;
          border-radius: 22px;
          padding: 18px;
          margin-top: 24px;
        }

        .upload-card:first-of-type {
          margin-top: 0;
        }

        .upload-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 16px;
        }

        .upload-title {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .mini-icon {
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #2e1a47;
          border: 1px solid rgba(139, 92, 246, 0.22);
          color: #8b5cf6;
          border-radius: 14px;
          flex: 0 0 auto;
        }

        .upload-title h3 {
          margin: 0;
          color: #6b7280;
          font-size: 10px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .upload-title p {
          margin: 5px 0 0;
          color: white;
          font-size: 14px;
          font-weight: 800;
          max-width: 280px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .check {
          color: #22c55e;
          flex: 0 0 auto;
        }

        .upload-box {
          height: 260px;
          background: #12121a;
          border: 2px dashed #3b3b4f;
          border-radius: 20px;
          overflow: hidden;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: border-color 0.2s, transform 0.2s;
        }

        .upload-box:hover {
          border-color: #8b5cf6;
          transform: translateY(-1px);
        }

        .upload-box img,
        .upload-box video {
          width: 100%;
          height: 100%;
          object-fit: contain;
          background: rgba(0, 0, 0, 0.45);
        }

        .empty-state {
          text-align: center;
          padding: 20px;
          color: #d1d5db;
        }

        .empty-state svg {
          display: block;
          margin: 0 auto 12px;
          color: #3b3b4f;
        }

        .empty-state strong {
          display: block;
          font-size: 14px;
          margin-bottom: 6px;
        }

        .empty-state small {
          color: #6b7280;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .hover-layer {
          position: absolute;
          inset: 0;
          opacity: 0;
          background: rgba(0, 0, 0, 0.65);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: opacity 0.2s;
          backdrop-filter: blur(6px);
        }

        .upload-box:hover .hover-layer {
          opacity: 1;
        }

        .hover-layer span,
        .replace-video {
          background: #8b5cf6;
          color: white;
          border-radius: 14px;
          padding: 10px 18px;
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.06em;
        }

        .replace-video {
          position: absolute;
          top: 14px;
          right: 14px;
          background: rgba(0, 0, 0, 0.78);
          border: 1px solid rgba(255, 255, 255, 0.12);
          cursor: pointer;
        }

        .replace-video:hover {
          background: #8b5cf6;
        }

        .textarea-wrap {
          position: relative;
        }

        .textarea-wrap span {
          position: absolute;
          right: 16px;
          bottom: 14px;
          color: #6b7280;
          font-size: 10px;
          font-weight: 800;
        }

        .settings-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-top: 24px;
        }

        .range-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 18px;
        }

        .range-head label {
          margin-bottom: 0;
        }

        .range-head strong {
          background: #2e1a47;
          border: 1px solid rgba(139, 92, 246, 0.22);
          color: #8b5cf6;
          border-radius: 12px;
          padding: 6px 12px;
          font-size: 14px;
        }

        .range {
          appearance: none;
          width: 100%;
          height: 10px;
          border: 0;
          border-radius: 999px;
          padding: 0;
          cursor: pointer;
        }

        .range::-webkit-slider-thumb {
          appearance: none;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: white;
          border: 4px solid #8b5cf6;
          box-shadow: 0 0 18px rgba(139, 92, 246, 0.45);
        }

        .generate-button {
          width: 100%;
          margin-top: 34px;
          padding: 24px 22px;
          border-radius: 34px;
          background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
          border: 1px solid rgba(255, 255, 255, 0.14);
          color: white;
          font-size: clamp(20px, 4vw, 30px);
          font-weight: 950;
          letter-spacing: -0.03em;
          text-transform: uppercase;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          cursor: pointer;
          box-shadow: 0 26px 80px rgba(139, 92, 246, 0.32);
          transition: transform 0.22s, box-shadow 0.22s, opacity 0.22s, filter 0.22s;
        }

        .generate-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 30px 100px rgba(139, 92, 246, 0.4);
          filter: saturate(1.08);
        }

        .generate-button:disabled {
          cursor: not-allowed;
          opacity: 0.76;
          background: #3b3057;
          border-color: #3b3b4f;
          color: #c7d2fe;
          box-shadow: none;
        }

        .generate-button:hover:not(:disabled) {
          transform: translateY(-3px);
          box-shadow: 0 30px 90px rgba(139, 92, 246, 0.55);
        }

        .generate-button:active:not(:disabled) {
          transform: scale(0.98);
        }

        .generate-button:disabled {
          cursor: not-allowed;
          opacity: 0.7;
          background: #2a1a47;
          border-color: #3b3b4f;
          color: #9ca3af;
          box-shadow: none;
        }

        .spinner {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          border: 4px solid rgba(255, 255, 255, 0.25);
          border-top-color: white;
          animation: spin 0.9s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .result-card {
          border: 4px solid #8b5cf6;
          border-radius: 42px;
          padding: 34px;
          box-shadow: 0 0 90px rgba(139, 92, 246, 0.3);
        }

        .result-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding-bottom: 20px;
          margin-bottom: 24px;
          border-bottom: 1px solid #2a2a35;
        }

        .result-head div {
          display: flex;
          align-items: center;
          gap: 14px;
          color: white;
        }

        .result-head svg:first-child {
          color: #8b5cf6;
        }

        .result-head > svg {
          color: #22c55e;
        }

        .result-head h2 {
          margin: 0;
          font-size: 24px;
          font-weight: 950;
          letter-spacing: -0.04em;
        }

        .result-video-wrap {
          background: black;
          border: 2px solid #3b3b4f;
          border-radius: 24px;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .result-video-wrap video {
          width: 100%;
          max-height: 620px;
          object-fit: contain;
        }

        .download-button {
          display: block;
          margin-top: 24px;
          background: #8b5cf6;
          color: white;
          text-align: center;
          text-decoration: none;
          padding: 18px;
          border-radius: 18px;
          font-size: 18px;
          font-weight: 950;
          letter-spacing: 0.05em;
        }

        .download-button:hover {
          background: #7c3aed;
        }

        @media (max-width: 720px) {
          .page {
            padding: 22px 12px 60px;
          }

          .card,
          .result-card {
            padding: 20px;
            border-radius: 24px;
          }

          .card-head.split {
            align-items: flex-start;
            flex-direction: column;
          }

          .settings-grid {
            grid-template-columns: 1fr;
          }

          .upload-title p {
            max-width: 190px;
          }
        }
      `}</style>
    </>
  );
}