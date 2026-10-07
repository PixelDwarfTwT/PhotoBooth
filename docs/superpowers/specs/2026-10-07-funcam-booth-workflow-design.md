# Booth Workflow Inspired by Reference Screenshots

## Intent and constraints

Build the capabilities represented by the three supplied screenshots within the existing PhotoBooth flow: use a phone as a remote camera, choose a motion-video filter, and finish with a clear result and output actions. The screenshots are visual and workflow references; use PhotoBooth's existing identity and Indonesian copy rather than copying Funcam assets or text.

Photo capture, Canvas composition, image exports, and motion exports stay in the browser. Remote-camera media travels directly between the phone and host browser over WebRTC. The API carries only short-lived signaling data (SDP and ICE candidates), never photo or video bytes. Cloud sharing continues to require the existing explicit consent. If a browser lacks WebRTC, Canvas, QR, or print support, the interface gives a useful fallback.

## User workflow

1. On the booth screen, the user can activate the local camera or open a short-lived phone-pairing dialog. The dialog contains a QR code and clear connection status. Scanning it opens a dedicated mobile camera page, asks for camera permission, and streams the live camera directly to the booth. The captured three photos still use the existing review and editor flow. The user can end pairing at any point.
2. In the editor, the user can select a motion filter (Normal, Hitam putih, Sepia, Negatif, or Blur) independently of the existing still-photo filter. The choice applies to locally generated GIF and video loop output.
3. The result area previews the completed photo composition and offers PNG/JPG, an Instagram Story-sized image, GIF/video loop, print, consent-based cloud share/QR, and take-again actions. The original local export remains available when cloud sharing is disabled.

## Architecture

- Add an API-owned in-memory pairing registry with random 256-bit session IDs, a five-minute expiry, a single phone peer, bounded SDP payloads, and explicit cleanup. Pairing endpoints are rate-limited and send `Cache-Control: no-store`.
- Use HTTP polling for SDP exchange so the API needs no WebSocket dependency. The browser waits for ICE gathering to finish before posting each description. One API process is the MVP deployment constraint; an API restart expires active pairings.
- Add a Next App Router route `/remote-camera/[sessionId]` that requests phone camera permission and establishes a peer connection. It stops all local media tracks and closes its connection on exit.
- Extend the current Canvas motion exporter with a closed set of CSS Canvas filters. Do not change the existing static photo filter pipeline.
- Add a local result section with story composition and print styling; re-use the existing share-consent flow and QR response rather than introducing a second cloud upload path.

## Error handling and privacy

- Require HTTPS on non-local origins for camera access; explain when the QR cannot be used from localhost or an insecure LAN origin.
- Report expired/missing pairing sessions, failed permission, unsupported WebRTC, ICE connection timeout, API errors, and unsupported export formats with retry/end actions.
- End pairing on completion, user cancellation, page unmount, or five-minute expiry. Revoke object URLs after use. Never log SDP, session IDs, share tokens, or media bytes.
- Print only the locally rendered result. Story export and animated exports remain client-side.

## Acceptance criteria

- A desktop host can create a pairing QR; a phone with camera permission can join, and its video appears in the existing preview and can be captured in the regular three-photo sequence.
- A pairing session is single-use, expires after five minutes, and cannot be read or written after close/expiry.
- Five motion filter choices alter GIF/video output but leave the still-photo filter selection independent.
- Story output is a locally generated 9:16 PNG with the selected composition centered and no photo upload.
- Print opens a print-ready rendition; take-again resets the existing capture session.
- Existing photo capture, editor, sharing consent, and exports continue to work.

## Known limits

WebRTC requires a direct peer route or compatible STUN/TURN connectivity. This MVP uses STUN only; restrictive networks may not connect. The signaling registry is process-local, so deployments must route a pairing session's requests to one API instance. Camera pairing from a phone requires the deployed HTTPS origin; a desktop `localhost` QR cannot resolve to the desktop from a phone.
