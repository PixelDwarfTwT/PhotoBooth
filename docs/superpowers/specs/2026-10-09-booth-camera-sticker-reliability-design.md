# Booth camera and sticker reliability

## Goal

Show camera imagery in its natural orientation, support remote camera pairing across restrictive networks when a TURN relay is configured, and keep sticker dragging responsive.

## Current behavior and causes

- `BoothSession` starts with horizontal mirroring enabled. The preview CSS and canvas compositor both flip the image, so the final composition is flipped too.
- The phone and booth create peer connections with only Google's public STUN server. STUN can discover direct paths but does not relay media when network NAT/firewall rules prevent a direct path.
- `StickerLayer` writes React state on every pointer move. `PhotoEditor` watches that state and reruns the complete photo/frame compositor, delaying the visual response while dragging.

## Design

### Natural camera orientation

Remove the mirror toggle and mirror state. Keep both the live booth preview and composed/exported photos in their captured orientation. The phone-side preview already has no horizontal transform.

### TURN support for remote camera

Keep STUN as the default direct-connection path and add optional Coturn REST-auth support. The API stores `TURN_URLS` and `TURN_SHARED_SECRET`; it mints a short-lived credential using the standard expiry-prefixed username and HMAC-SHA1 password, and returns the ICE server list from a rate-limited, active-session endpoint. The long-lived shared secret never reaches a browser. Both peers fetch that ICE configuration before creating their `RTCPeerConnection`.

When TURN variables are absent, the API returns STUN only and reports that relay is not configured. The UI explains that a relay is needed if direct connection fails. This code change does not provision or host TURN; cross-network relay requires a reachable Coturn-compatible TURN service, matching shared secret, and UDP/TCP firewall access configured by the operator.

### Responsive sticker dragging

During pointer movement, update the dragged handle's CSS position directly and keep the changing coordinates in refs. Do not commit React state for each pointer event. Exclude the actively dragged sticker from the composed canvas while dragging so its baked-in copy does not remain behind the moving handle. On pointer up/cancel, commit the final normalized position once and restore the sticker to the composition; keyboard controls keep their current state-based behavior.

## Interfaces and configuration

- API environment: optional `TURN_URLS` (comma-separated `turn:`/`turns:` URLs), `TURN_SHARED_SECRET` (API-only Coturn REST secret), and optional `TURN_CREDENTIAL_TTL_SECONDS` (default 900; accepted range 60–3600).
- API route: `GET /api/remote-camera/sessions/:sessionId/ice-servers`, requiring an active high-entropy session ID; returns STUN plus optional expiring TURN credentials and a `turnConfigured` boolean.
- Browser clients validate the response and use the same ICE configuration for offer and answer.
- Document the variables in `.env.example` and deployment setup guidance. Never add real credentials to tracked files.

## Acceptance criteria

1. The booth preview and all final exports are not horizontally flipped, and the editor no longer offers an enabled mirror switch.
2. Both WebRTC peers use the API-provided ICE servers. With TURN configured, responses contain only short-lived credentials; without TURN, signaling continues with STUN and the interface reports the relay limitation on connection failure.
3. Dragging updates the sticker handle without re-rendering the full canvas per pointer event; the final location is committed on pointer completion and included in the composition.
4. Existing camera capture, pairing, and keyboard sticker controls remain intact.

## Out of scope

- Provisioning, paying for, or operating the TURN relay.
- Replacing the current SDP polling/signaling transport.
- Changing photo capture, filter, frame selection, or export formats.
