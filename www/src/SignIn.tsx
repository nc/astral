import Asterisk3D from "./Asterisk3D";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8787";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GCP_OAUTH_CLIENT_ID;

export function SignIn() {
  const handleSignIn = () => {
    const redirectUri = `${BACKEND_URL}/auth/callback`;
    const scope = "email profile openid";

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scope);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");

    window.location.href = authUrl.toString();
  };

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          .signin-container {
            flex-direction: column !important;
            padding: 24px !important;
          }
          .asterisk-wrapper {
            position: relative !important;
            left: 0 !important;
            top: 0 !important;
            transform: none !important;
            width: 246px !important;
            height: 263px !important;
            margin: 0 auto 40px auto !important;
          }
          .content-wrapper {
            margin-left: 0 !important;
            align-items: center !important;
            text-align: center !important;
          }
          .signin-title {
            font-size: 24px !important;
            line-height: 32px !important;
          }
          .features-list {
            align-items: center !important;
          }
        }
      `}</style>
      <div
        className="signin-container"
        style={{
          display: "flex",
          width: "100vw",
          height: "100vh",
          backgroundColor: "#151817",
          fontFamily: "Inter, system-ui, -apple-system, sans-serif",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {/* 3D Model - Background, positioned absolutely */}
        <div
          className="asterisk-wrapper"
          style={{
            position: "absolute",
            left: "10%",
            top: "50%",
            transform: "translateY(-50%)",
            width: "600px",
            height: "600px",
            zIndex: 0,
          }}
        >
          <Asterisk3D />
        </div>

        {/* Content - Centered */}
        <div
          className="content-wrapper"
          style={{
            marginLeft: "400px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            zIndex: 1,
            position: "relative",
          }}
        >
          {/* Title */}
          <h1
            className="signin-title"
            style={{
              fontSize: "32px",
              fontWeight: "600",
              color: "#ffffff",
              margin: "0 0 12px 0",
            }}
          >
            Astral
          </h1>

          {/* Tagline */}
          <p
            style={{
              fontSize: "14px",
              fontWeight: "600",
              color: "#8d9693",
              margin: "0 0 24px 0",
              lineHeight: "24px",
            }}
          >
            The pro-user GPT client.
          </p>

          {/* Sign in button */}
          <button
            onClick={handleSignIn}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "200px",
              height: "36px",
              padding: "0 24px",
              backgroundColor: "#5ba97d",
              color: "#ffffff",
              border: "none",
              borderRadius: "9px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
              marginBottom: "32px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow =
                "0 2px 8px rgba(91, 169, 125, 0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            Sign in with Google
          </button>

          {/* Features list */}
          <div
            className="features-list"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0",
              fontSize: "12px",
              fontWeight: "500",
              color: "#ffffff",
              opacity: 0.4,
              lineHeight: "24px",
            }}
          >
            <p style={{ margin: 0 }}>Multi-model</p>
            <p style={{ margin: 0 }}>Branching</p>
            <p style={{ margin: 0 }}>Themes</p>
            <p style={{ margin: 0 }}>Artifacts</p>
            <p style={{ margin: 0 }}>Keyboard shortcuts</p>
            <p style={{ margin: 0 }}>Free during beta</p>
          </div>
        </div>

        {/* Footer - Absolute positioned at bottom */}
        <div
          style={{
            position: "absolute",
            bottom: "24px",
            left: "24px",
            fontSize: "12px",
            fontWeight: "500",
            color: "#ffffff",
            opacity: 0.4,
            lineHeight: "24px",
          }}
        >
          Privacy Policy · Support · 2025
        </div>
      </div>
    </>
  );
}
