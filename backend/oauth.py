from authlib.integrations.flask_client import OAuth

oauth = OAuth()


def init_oauth(app):
    oauth.init_app(app)
    oauth.register(
        name="google",
        client_id=app.config["GOOGLE_CLIENT_ID"],
        client_secret=app.config["GOOGLE_CLIENT_SECRET"],
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        # Authlib has a known bug where jwks_uri sometimes isn't picked up from
        # the discovery document above — passing it explicitly works around that.
        jwks_uri="https://www.googleapis.com/oauth2/v3/certs",
        client_kwargs={"scope": "openid email profile"},
    )
    return oauth