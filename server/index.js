const { WebSocketServer } = require('ws');
const { v4: uuidv4 } = require('uuid');
const { AccessToken } = require('livekit-server-sdk');

const PORT = 3001;

// ─── LiveKit Configuration ────────────────────────────────────
// Sign up at https://cloud.livekit.io (free tier)
// Then paste your credentials here:
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'YOUR_API_KEY';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'YOUR_API_SECRET';
const LIVEKIT_URL = process.env.LIVEKIT_URL || 'wss://YOUR_PROJECT.livekit.cloud';
const ROOM_NAME = 'zymesh-office'; // Single room for MVP

const wss = new WebSocketServer({ port: PORT });

// In-memory player state
const players = new Map();
const wsToPlayer = new Map();
const playerToWs = new Map();

// Active challenge games — keyed by a pair ID
const activeGames = new Map();

// ─── Hardcoded Easy Math Problems ─────────────────────────────
const MATH_PROBLEMS = [
  { equation: '3 + 5 = ?', answer: 8 },
  { equation: '7 + 4 = ?', answer: 11 },
  { equation: '9 - 3 = ?', answer: 6 },
  { equation: '12 - 5 = ?', answer: 7 },
  { equation: '6 + 8 = ?', answer: 14 },
  { equation: '15 - 7 = ?', answer: 8 },
  { equation: '2 x 6 = ?', answer: 12 },
  { equation: '3 x 4 = ?', answer: 12 },
  { equation: '5 x 3 = ?', answer: 15 },
  { equation: '10 + 9 = ?', answer: 19 },
  { equation: '18 - 6 = ?', answer: 12 },
  { equation: '4 x 5 = ?', answer: 20 },
  { equation: '7 + 6 = ?', answer: 13 },
  { equation: '14 - 8 = ?', answer: 6 },
  { equation: '2 x 9 = ?', answer: 18 },
  { equation: '11 + 5 = ?', answer: 16 },
  { equation: '20 - 4 = ?', answer: 16 },
  { equation: '8 + 7 = ?', answer: 15 },
  { equation: '6 x 2 = ?', answer: 12 },
  { equation: '9 + 9 = ?', answer: 18 },
];
let lastMathIndex = -1;

function generateMathEquation() {
  let idx;
  do {
    idx = Math.floor(Math.random() * MATH_PROBLEMS.length);
  } while (idx === lastMathIndex);
  lastMathIndex = idx;
  return MATH_PROBLEMS[idx];
}

// ─── Memory Grid Generator ────────────────────────────────────
function generateMemoryGrid(gridSize, numLit) {
  const totalCells = gridSize * gridSize;
  const indices = [];
  while (indices.length < numLit) {
    const idx = Math.floor(Math.random() * totalCells);
    if (!indices.includes(idx)) indices.push(idx);
  }
  return indices.sort((a, b) => a - b);
}

function getPairId(id1, id2) {
  return [id1, id2].sort().join('::');
}

function sendToPlayer(playerId, data) {
  const ws = playerToWs.get(playerId);
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(data));
  }
}

console.log(`🟢 EchoGrid server running on ws://0.0.0.0:${PORT}`);
if (LIVEKIT_API_KEY === 'YOUR_API_KEY') {
  console.log(`⚠️  LiveKit not configured! Set LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL`);
  console.log(`   Get free keys at: https://cloud.livekit.io`);
} else {
  console.log(`🎙️  LiveKit configured → ${LIVEKIT_URL}`);
}

// Generate a LiveKit access token for a player
async function generateLiveKitToken(playerId, nickname) {
  if (LIVEKIT_API_KEY === 'YOUR_API_KEY') {
    return null; // Not configured
  }

  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: playerId,
    name: nickname,
  });

  token.addGrant({
    room: ROOM_NAME,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
  });

  return await token.toJwt();
}

wss.on('connection', (ws) => {
  let playerId = null;

  ws.on('message', async (raw) => {
    let data;
    try {
      data = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (data.type) {
      case 'join': {
        playerId = uuidv4();
        const player = {
          id: playerId,
          x: 200 + Math.floor(Math.random() * 300),
          y: 200 + Math.floor(Math.random() * 200),
          dir: 'down',
          nickname: (data.nickname || 'Anon').slice(0, 16),
          avatarId: Math.min(5, Math.max(1, parseInt(data.avatarId) || 1)),
        };

        players.set(playerId, player);
        wsToPlayer.set(ws, playerId);
        playerToWs.set(playerId, ws);

        // Generate LiveKit token
        let livekitToken = null;
        try {
          livekitToken = await generateLiveKitToken(playerId, player.nickname);
        } catch (err) {
          console.error('LiveKit token error:', err.message);
        }

        // Send welcome with assigned ID + LiveKit token
        ws.send(
          JSON.stringify({
            type: 'welcome',
            id: playerId,
            livekitToken,
            livekitUrl: LIVEKIT_API_KEY !== 'YOUR_API_KEY' ? LIVEKIT_URL : null,
            roomName: ROOM_NAME,
          })
        );

        // Send full state to the new player
        ws.send(
          JSON.stringify({
            type: 'state',
            yourId: playerId,
            players: Array.from(players.values()),
          })
        );

        // Broadcast new player to everyone else
        broadcast(
          ws,
          JSON.stringify({
            type: 'player_joined',
            player,
          })
        );

        console.log(
          `👤 ${player.nickname} joined (${playerId}) — ${players.size} online`
        );
        break;
      }

      case 'move': {
        if (!playerId || !players.has(playerId)) return;

        const player = players.get(playerId);
        player.x = Math.round(data.x);
        player.y = Math.round(data.y);
        player.dir = data.dir || player.dir;

        broadcast(
          ws,
          JSON.stringify({
            type: 'player_moved',
            id: playerId,
            x: player.x,
            y: player.y,
            dir: player.dir,
          })
        );
        break;
      }

      case 'chat': {
        if (!playerId || !players.has(playerId)) return;
        const sender = players.get(playerId);
        const text = (data.text || '').slice(0, 200);
        if (!text) return;

        const HEARING_THRESHOLD = 120;
        const msgId = uuidv4();

        // Send only to players within proximity range
        wss.clients.forEach((client) => {
          if (client === ws || client.readyState !== 1) return;
          const recipientId = wsToPlayer.get(client);
          if (!recipientId) return;
          const recipient = players.get(recipientId);
          if (!recipient) return;

          const dx = sender.x - recipient.x;
          const dy = sender.y - recipient.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < HEARING_THRESHOLD) {
            client.send(
              JSON.stringify({
                type: 'chat',
                id: msgId,
                senderId: playerId,
                senderName: sender.nickname,
                text,
                timestamp: Date.now(),
              })
            );
          }
        });

        console.log(`💬 ${sender.nickname}: "${text}"`);
        break;
      }

      // ─── Challenge Protocol ──────────────────────────────────
      case 'challenge_invite': {
        if (!playerId || !players.has(playerId)) {
          console.log(`⚔️  challenge_invite: sender ${playerId} not found`);
          return;
        }
        const target = data.targetId;
        if (!target || !players.has(target)) {
          console.log(`⚔️  challenge_invite: target ${target} not found in ${Array.from(players.keys()).join(', ')}`);
          return;
        }

        const sender = players.get(playerId);
        const targetWs = playerToWs.get(target);
        console.log(`⚔️  ${sender.nickname} → ${players.get(target).nickname} | target ws exists: ${!!targetWs} | ws open: ${targetWs?.readyState === 1}`);

        sendToPlayer(target, {
          type: 'challenge_invite',
          fromId: playerId,
          fromName: sender.nickname,
          gameType: data.gameType || 'math',
        });
        console.log(`⚔️  challenge_invite sent to ${players.get(target).nickname}`);
        break;
      }

      case 'challenge_response': {
        if (!playerId || !players.has(playerId)) return;
        const challengerId = data.targetId;
        if (!challengerId || !players.has(challengerId)) return;

        const responder = players.get(playerId);

        if (data.accepted) {
          // Notify challenger that it was accepted
          sendToPlayer(challengerId, {
            type: 'challenge_response',
            accepted: true,
            fromId: playerId,
            fromName: responder.nickname,
          });

          // Start the game
          const pairId = getPairId(playerId, challengerId);
          const gameType = data.gameType || 'math';

          const game = {
            pairId,
            players: [playerId, challengerId],
            gameType,
            roundIndex: 0,
            totalRounds: 3,
            scores: { [playerId]: 0, [challengerId]: 0 },
            answers: {},
          };
          activeGames.set(pairId, game);
          startNextRound(pairId);
          console.log(`🎮 Game started: ${gameType} between ${players.get(playerId).nickname} & ${players.get(challengerId).nickname}`);
        } else {
          sendToPlayer(challengerId, {
            type: 'challenge_declined',
            fromId: playerId,
            fromName: responder.nickname,
          });
        }
        break;
      }

      case 'game_action': {
        if (!playerId) return;

        // Find the active game for this player
        let game = null;
        let pairId = null;
        for (const [pid, g] of activeGames) {
          if (g.players.includes(playerId)) {
            game = g;
            pairId = pid;
            break;
          }
        }
        if (!game || !pairId) return;

        if (game.gameType === 'math') {
          game.answers[playerId] = data.answer;

          // Check if both have answered
          if (Object.keys(game.answers).length === 2) {
            evaluateMathRound(pairId);
          }
        } else if (game.gameType === 'memory') {
          game.answers[playerId] = data.selectedBoxes || [];

          if (Object.keys(game.answers).length === 2) {
            evaluateMemoryRound(pairId);
          }
        }
        break;
      }
    }
  });

  ws.on('close', () => {
    if (playerId && players.has(playerId)) {
      const player = players.get(playerId);
      console.log(
        `👋 ${player.nickname} left (${playerId}) — ${players.size - 1} online`
      );
      players.delete(playerId);
      wsToPlayer.delete(ws);
      playerToWs.delete(playerId);

      // Clean up any active games
      for (const [pairId, game] of activeGames) {
        if (game.players.includes(playerId)) {
          const otherId = game.players.find((id) => id !== playerId);
          if (otherId) {
            sendToPlayer(otherId, {
              type: 'game_result',
              winnerId: otherId,
              winnerName: players.get(otherId)?.nickname || 'Unknown',
              loserId: playerId,
              loserName: player.nickname,
              reason: 'Opponent disconnected',
            });
          }
          activeGames.delete(pairId);
        }
      }

      broadcastAll(
        JSON.stringify({
          type: 'player_left',
          id: playerId,
        })
      );
    }
  });

  ws.on('error', () => {
    ws.close();
  });
});

function broadcast(senderWs, message) {
  wss.clients.forEach((client) => {
    if (client !== senderWs && client.readyState === 1) {
      client.send(message);
    }
  });
}

function broadcastAll(message) {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
}

// ─── Game Round Management ──────────────────────────────────────

function startNextRound(pairId) {
  const game = activeGames.get(pairId);
  if (!game) return;

  game.answers = {};

  if (game.gameType === 'math') {
    const { equation, answer } = generateMathEquation();
    game.currentAnswer = answer;

    game.players.forEach((pid) => {
      sendToPlayer(pid, {
        type: 'game_sync_math',
        equation,
        answer, // Client doesn't need this for display, but keeping for validation
        roundIndex: game.roundIndex,
        totalRounds: game.totalRounds,
      });
    });
  } else if (game.gameType === 'memory') {
    const gridSize = 4;
    // Increase difficulty each round: 4, 5, 6 lit boxes
    const numLit = Math.min(4 + game.roundIndex, 8);
    const sequence = generateMemoryGrid(gridSize, numLit);
    game.currentSequence = sequence;

    const observeTimeMs = 3000; // 3 seconds to observe

    game.players.forEach((pid) => {
      sendToPlayer(pid, {
        type: 'game_sync_memory',
        gridSize,
        sequence,
        observeTimeMs,
        roundIndex: game.roundIndex,
        totalRounds: game.totalRounds,
      });
    });
  }
}

function evaluateMathRound(pairId) {
  const game = activeGames.get(pairId);
  if (!game) return;

  const [p1, p2] = game.players;
  const a1 = game.answers[p1];
  const a2 = game.answers[p2];
  const correct = game.currentAnswer;

  const p1Correct = Math.abs(a1 - correct) < 0.01;
  const p2Correct = Math.abs(a2 - correct) < 0.01;

  let winnerId = 'tie';
  if (p1Correct && !p2Correct) winnerId = p1;
  else if (p2Correct && !p1Correct) winnerId = p2;
  else if (p1Correct && p2Correct) winnerId = 'tie'; // both correct = tie (first submit wins handled client-side, but simplifying)

  if (winnerId !== 'tie') {
    game.scores[winnerId]++;
  }

  // Notify both players of round result
  game.players.forEach((pid) => {
    sendToPlayer(pid, {
      type: 'round_result',
      gameType: 'math',
      winnerId,
      correctAnswer: correct,
      roundIndex: game.roundIndex,
    });
  });

  game.roundIndex++;

  // Check if game is over
  if (game.roundIndex >= game.totalRounds) {
    setTimeout(() => endGame(pairId), 1500);
  } else {
    setTimeout(() => startNextRound(pairId), 2000);
  }
}

function evaluateMemoryRound(pairId) {
  const game = activeGames.get(pairId);
  if (!game) return;

  const [p1, p2] = game.players;
  const s1 = game.answers[p1] || [];
  const s2 = game.answers[p2] || [];
  const correct = game.currentSequence;

  // Score = how many correct selections minus wrong selections
  function calcScore(selected) {
    const correctSet = new Set(correct);
    let hits = 0;
    let misses = 0;
    selected.forEach((idx) => {
      if (correctSet.has(idx)) hits++;
      else misses++;
    });
    // Also penalize for missed boxes
    const missed = correct.length - hits;
    return hits - misses - missed;
  }

  const score1 = calcScore(s1);
  const score2 = calcScore(s2);

  let winnerId = 'tie';
  if (score1 > score2) winnerId = p1;
  else if (score2 > score1) winnerId = p2;

  if (winnerId !== 'tie') {
    game.scores[winnerId]++;
  }

  game.players.forEach((pid) => {
    sendToPlayer(pid, {
      type: 'round_result',
      gameType: 'memory',
      winnerId,
      correctSequence: correct,
      roundIndex: game.roundIndex,
    });
  });

  game.roundIndex++;

  if (game.roundIndex >= game.totalRounds) {
    setTimeout(() => endGame(pairId), 1500);
  } else {
    setTimeout(() => startNextRound(pairId), 2500);
  }
}

function endGame(pairId) {
  const game = activeGames.get(pairId);
  if (!game) return;

  const [p1, p2] = game.players;
  const s1 = game.scores[p1] || 0;
  const s2 = game.scores[p2] || 0;

  let winnerId, loserId;
  if (s1 > s2) {
    winnerId = p1;
    loserId = p2;
  } else if (s2 > s1) {
    winnerId = p2;
    loserId = p1;
  } else {
    // Tie — pick random
    winnerId = Math.random() > 0.5 ? p1 : p2;
    loserId = winnerId === p1 ? p2 : p1;
  }

  const result = {
    type: 'game_result',
    winnerId,
    winnerName: players.get(winnerId)?.nickname || 'Unknown',
    loserId,
    loserName: players.get(loserId)?.nickname || 'Unknown',
    reason: s1 === s2 ? 'Tiebreaker!' : `Score: ${game.scores[winnerId]} - ${game.scores[loserId]}`,
    scores: game.scores,
  };

  game.players.forEach((pid) => {
    sendToPlayer(pid, result);
  });

  activeGames.delete(pairId);
  console.log(`🏆 Game over: ${result.winnerName} wins! (${result.reason})`);
}
