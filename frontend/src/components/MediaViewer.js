/**
 * MediaViewer - Lecteur Afroboost Mode Cinéma V3
 * Player HTML5 natif sans marquage externe
 * Spécification: Design cinéma, bouton CTA #E91E63, AUCUN logo tiers
 */
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL || '';

// Détecte si l'URL est une vidéo directe (MP4, WebM, Google Drive, etc.)
const isDirectVideoUrl = (url) => {
  if (!url) return false;
  const lowerUrl = url.toLowerCase();
  
  // Extensions vidéo directes
  const videoExtensions = ['.mp4', '.webm', '.mov', '.m4v', '.ogv', '.ogg'];
  if (videoExtensions.some(ext => lowerUrl.includes(ext))) return true;
  
  // Google Drive links
  if (lowerUrl.includes('drive.google.com')) return true;
  
  // Autres hébergeurs vidéo directs
  if (lowerUrl.includes('cloudinary.com') && lowerUrl.includes('/video/')) return true;
  
  return false;
};

// Convertit un lien Google Drive en URL de streaming
const getVideoStreamUrl = (url) => {
  if (!url) return url;
  
  // Google Drive: extraire l'ID et créer un lien preview (streaming via iframe)
  if (url.includes('drive.google.com')) {
    // Format: https://drive.google.com/file/d/{FILE_ID}/view
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      // Utiliser le format preview pour le streaming vidéo (iframe)
      return `https://drive.google.com/file/d/${match[1]}/preview`;
    }
    // Format: https://drive.google.com/uc?export=download&id={FILE_ID}
    const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idMatch && idMatch[1]) {
      return `https://drive.google.com/file/d/${idMatch[1]}/preview`;
    }
  }
  
  return url;
};

// Vérifie si c'est un lien Google Drive (nécessite iframe)
const isGoogleDriveUrl = (url) => {
  return url && url.toLowerCase().includes('drive.google.com');
};

const MediaViewer = ({ slug }) => {
  const [media, setMedia] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    const loadMedia = async () => {
      try {
        console.log('[MediaViewer] Chargement du slug:', slug);
        const response = await axios.get(`${API}/api/media/${slug}`);
        console.log('[MediaViewer] Données reçues:', JSON.stringify(response.data));
        setMedia(response.data);
      } catch (err) {
        console.error('[MediaViewer] Erreur:', err);
        setError(err.response?.data?.detail || 'Média non trouvé');
      } finally {
        setLoading(false);
      }
    };
    if (slug) loadMedia();
  }, [slug]);

  // Gérer le play
  const handlePlayClick = () => {
    setIsPlaying(true);
  };

  // État de chargement - Mode Cinéma
  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p style={styles.loadingText}>Chargement...</p>
      </div>
    );
  }

  // État d'erreur
  if (error) {
    return (
      <div style={styles.errorContainer}>
        <p style={styles.errorText}>{error}</p>
        <a href="https://afroboosteur.com" style={styles.errorLink}>Retour à l'accueil</a>
      </div>
    );
  }

  // Protection: vérifier que media existe
  if (!media) {
    return (
      <div style={styles.errorContainer}>
        <p style={styles.errorText}>Données non disponibles</p>
        <a href="https://afroboosteur.com" style={styles.errorLink}>Retour à l'accueil</a>
      </div>
    );
  }

  // Détermine le type de lecteur à utiliser
  const hasDirectVideo = isDirectVideoUrl(media.video_url);
  const isGoogleDrive = isGoogleDriveUrl(media.video_url);
  const videoStreamUrl = getVideoStreamUrl(media.video_url);
  const thumbnailUrl = media.thumbnail || (media.youtube_id ? `https://img.youtube.com/vi/${media.youtube_id}/maxresdefault.jpg` : null);

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <a href="https://afroboosteur.com" style={styles.logo}>
          <span style={styles.logoIcon}>🎧</span>
          <span style={styles.logoText}>Afroboost</span>
        </a>
      </header>

      {/* Main Content */}
      <main style={styles.main}>
        {/* Titre - Au-dessus de la vidéo */}
        <h1 style={styles.title} data-testid="media-title">{media.title || 'Sans titre'}</h1>

        {/* Lecteur Vidéo - Mode Cinéma 16:9 */}
        <div style={styles.videoWrapper} data-testid="video-container">
          {isGoogleDrive ? (
            /* Player HTML5 natif pour Google Drive - ZÉRO MARQUAGE */
            !isPlaying ? (
              <>
                <div 
                  style={{
                    ...styles.thumbnailContainer,
                    backgroundImage: thumbnailUrl ? `url(${thumbnailUrl})` : 'linear-gradient(135deg, #1a1a2e 0%, #0c0014 100%)',
                  }}
                >
                  <div style={styles.thumbnailOverlay}></div>
                  <button 
                    onClick={handlePlayClick}
                    style={styles.playButton}
                    data-testid="play-button"
                    aria-label="Lire la vidéo"
                  >
                    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                      <circle cx="40" cy="40" r="38" fill="#E91E63" fillOpacity="0.95"/>
                      <path d="M32 25L58 40L32 55V25Z" fill="white"/>
                    </svg>
                  </button>
                </div>
              </>
            ) : (
              /* Video HTML5 natif avec lien direct Google Drive */
              <video
                ref={videoRef}
                src={videoStreamUrl}
                poster={thumbnailUrl}
                style={styles.videoPlayer}
                controls
                autoPlay
                controlsList="nodownload noremoteplayback"
                playsInline
                onPause={() => setIsPlaying(false)}
                onError={(e) => {
                  console.error('[MediaViewer] Erreur chargement vidéo:', e);
                  setIsPlaying(false); // Revenir à la thumbnail si erreur
                }}
                onLoadStart={() => console.log('[MediaViewer] Début chargement vidéo Drive')}
                onCanPlay={() => console.log('[MediaViewer] Vidéo prête à jouer')}
                data-testid="html5-video-drive"
              >
                Votre navigateur ne supporte pas la lecture vidéo.
              </video>
            )
          ) : hasDirectVideo ? (
            /* Player HTML5 natif pour vidéos directes (MP4, WebM) */
            <video
              ref={videoRef}
              src={media.video_url}
              poster={thumbnailUrl}
              style={styles.videoPlayer}
              controls
              controlsList="nodownload noremoteplayback"
              playsInline
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              data-testid="html5-video"
            >
              Votre navigateur ne supporte pas la lecture vidéo.
            </video>
          ) : (
            /* Player YouTube avec thumbnail personnalisée */
            <>
              {!isPlaying ? (
                <div 
                  style={{
                    ...styles.thumbnailContainer,
                    backgroundImage: `url(${thumbnailUrl})`,
                  }}
                >
                  <div style={styles.thumbnailOverlay}></div>
                  <button 
                    onClick={handlePlayClick}
                    style={styles.playButton}
                    data-testid="play-button"
                    aria-label="Lire la vidéo"
                  >
                    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                      <circle cx="40" cy="40" r="38" fill="#E91E63" fillOpacity="0.95"/>
                      <path d="M32 25L58 40L32 55V25Z" fill="white"/>
                    </svg>
                  </button>
                </div>
              ) : (
                <iframe
                  src={`https://www.youtube.com/embed/${media.youtube_id}?autoplay=1&modestbranding=1&rel=0&iv_load_policy=3&controls=1&playsinline=1&showinfo=0`}
                  title={media.title || 'Vidéo Afroboost'}
                  style={styles.videoIframe}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              )}
            </>
          )}
        </div>

        {/* Description - En dessous de la vidéo, supporte les sauts de ligne */}
        {media.description && media.description.trim() !== '' && (
          <p style={styles.description} data-testid="media-description">
            {media.description}
          </p>
        )}

        {/* Bouton CTA ROSE #E91E63 - Point focal principal */}
        {media.cta_text && media.cta_link && (
          <div style={styles.ctaContainer} data-testid="cta-section">
            <a
              href={media.cta_link}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.ctaButton}
              data-testid="cta-button"
            >
              {media.cta_text}
            </a>
          </div>
        )}

        {/* Section Partage */}
        <div style={styles.shareSection}>
          <button
            onClick={() => {
              navigator.clipboard.writeText(`https://afroboosteur.com/v/${media.slug}`);
              alert('Lien copié !');
            }}
            style={styles.shareButton}
            data-testid="copy-link-btn"
          >
            📋 Copier le lien
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent((media.title || 'Vidéo') + '\nhttps://afroboosteur.com/v/' + media.slug)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.whatsappButton}
            data-testid="whatsapp-share-btn"
          >
            WhatsApp
          </a>
        </div>
      </main>

      {/* Footer */}
      <footer style={styles.footer}>
        © Afroboost 2025
      </footer>
    </div>
  );
};

// Styles V3 - Mode Cinéma avec Player HTML5 natif
const styles = {
  // Page - Fond sombre "cinéma"
  page: {
    minHeight: '100vh',
    backgroundColor: '#0c0014',
    color: '#FFFFFF',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
    display: 'flex',
    flexDirection: 'column',
  },
  
  // Loading
  loadingContainer: {
    minHeight: '100vh',
    backgroundColor: '#0c0014',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #333',
    borderTopColor: '#E91E63',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: '15px',
    fontSize: '16px',
  },
  
  // Error
  errorContainer: {
    minHeight: '100vh',
    backgroundColor: '#0c0014',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: '18px',
    marginBottom: '20px',
  },
  errorLink: {
    color: '#E91E63',
    textDecoration: 'none',
  },
  
  // Header - Rose Afroboost
  header: {
    backgroundColor: '#E91E63',
    padding: '12px 20px',
    textAlign: 'center',
  },
  logo: {
    color: '#FFFFFF',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
  },
  logoIcon: {
    fontSize: '22px',
  },
  logoText: {
    fontSize: '20px',
    fontWeight: 'bold',
  },
  
  // Main
  main: {
    flex: 1,
    maxWidth: '900px',
    width: '100%',
    margin: '0 auto',
    padding: '25px 15px',
  },
  
  // Title - Texte blanc
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: '20px',
    lineHeight: '1.3',
    color: '#FFFFFF',
  },
  
  // Video - Mode Cinéma 16:9
  videoWrapper: {
    position: 'relative',
    width: '100%',
    aspectRatio: '16 / 9',
    backgroundColor: '#000',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 0 30px rgba(233, 30, 99, 0.3)',
  },
  
  // Player HTML5 natif
  videoPlayer: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    backgroundColor: '#000',
  },
  
  // Thumbnail container pour YouTube
  thumbnailContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  
  // Overlay sombre sur la thumbnail
  thumbnailOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  
  // Bouton Play personnalisé
  playButton: {
    position: 'relative',
    zIndex: 10,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    transition: 'transform 0.2s ease',
    padding: 0,
  },
  
  // iframe YouTube (caché jusqu'au clic)
  videoIframe: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    border: 'none',
  },
  
  // Description - Texte blanc, supporte les sauts de ligne
  description: {
    fontSize: '16px',
    lineHeight: '1.7',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: '25px',
    marginBottom: '25px',
    whiteSpace: 'pre-wrap',
    padding: '0 10px',
  },
  
  // CTA Button - ROSE #E91E63 - Point focal
  ctaContainer: {
    textAlign: 'center',
    marginBottom: '35px',
  },
  ctaButton: {
    display: 'inline-block',
    padding: '20px 55px',
    backgroundColor: '#E91E63',
    color: '#FFFFFF',
    textDecoration: 'none',
    borderRadius: '50px',
    fontSize: '18px',
    fontWeight: 'bold',
    transition: 'transform 0.2s, box-shadow 0.2s',
    boxShadow: '0 6px 25px rgba(233, 30, 99, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  
  // Share
  shareSection: {
    display: 'flex',
    justifyContent: 'center',
    gap: '10px',
    flexWrap: 'wrap',
    paddingTop: '20px',
    borderTop: '1px solid #333',
  },
  shareButton: {
    padding: '10px 20px',
    backgroundColor: '#1a1a1a',
    color: '#FFFFFF',
    border: '1px solid #333',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  whatsappButton: {
    padding: '10px 20px',
    backgroundColor: '#25D366',
    color: '#FFFFFF',
    textDecoration: 'none',
    borderRadius: '8px',
    fontSize: '14px',
  },
  
  // Footer
  footer: {
    textAlign: 'center',
    padding: '20px',
    color: '#666',
    fontSize: '12px',
  },
};

export default MediaViewer;
