/**
 * MediaViewer - Lecteur Afroboost Mode Cinéma V2
 * Spécification utilisateur: Design cinéma, bouton CTA #E91E63, lecteur white-label
 */
import { useState, useEffect } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL || '';

const MediaViewer = ({ slug }) => {
  const [media, setMedia] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  // URL YouTube WHITE-LABEL - Paramètres pour masquer tout le branding YouTube
  const youtubeUrl = media.youtube_id 
    ? `https://www.youtube.com/embed/${media.youtube_id}?modestbranding=1&rel=0&iv_load_policy=3&controls=1&playsinline=1&showinfo=0&disablekb=1&fs=1&cc_load_policy=0&origin=${encodeURIComponent(window.location.origin)}`
    : media.video_url;

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

        {/* Lecteur Vidéo - Mode Cinéma 16:9 avec overlay anti-clic */}
        <div style={styles.videoWrapper} data-testid="video-container">
          <iframe
            src={youtubeUrl}
            title={media.title || 'Vidéo Afroboost'}
            style={styles.videoIframe}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
          />
          {/* Overlay transparent pour bloquer les clics vers YouTube (partie haute) */}
          <div style={styles.videoOverlayTop}></div>
        </div>

        {/* Description - En dessous de la vidéo, supporte les sauts de ligne */}
        {media.description && media.description.trim() !== '' && (
          <p style={styles.description} data-testid="media-description">
            {media.description}
          </p>
        )}

        {/* Bouton CTA ROSE #E91E63 - Après la description */}
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

// Styles V2 - Mode Cinéma avec bouton CTA #E91E63
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
  videoIframe: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    border: 'none',
  },
  // Overlay pour bloquer le lien "Watch on YouTube" en haut
  videoOverlayTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50px',
    background: 'transparent',
    cursor: 'default',
    zIndex: 10,
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
  
  // CTA Button - ROSE #E91E63 obligatoire
  ctaContainer: {
    textAlign: 'center',
    marginBottom: '35px',
  },
  ctaButton: {
    display: 'inline-block',
    padding: '18px 50px',
    backgroundColor: '#E91E63',
    color: '#FFFFFF',
    textDecoration: 'none',
    borderRadius: '50px',
    fontSize: '18px',
    fontWeight: 'bold',
    transition: 'transform 0.2s, box-shadow 0.2s',
    boxShadow: '0 4px 20px rgba(233, 30, 99, 0.5)',
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
