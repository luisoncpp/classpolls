import * as jose from 'jose';

export async function verifyGoogleToken(idToken: string, clientId: string) {
  const JWKS = jose.createRemoteJWKSet(
    new URL('https://www.googleapis.com/oauth2/v3/certs')
  );
  
  const { payload } = await jose.jwtVerify(idToken, JWKS, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: clientId,
  });
  
  return payload;
}
