import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  StatusBar,
  SafeAreaView,
} from 'react-native';

const GRID_SIZE = 8;
const COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];
const MAX_MOVES = 20;
const { width } = Dimensions.get('window');
const GEM_SIZE = Math.floor((width - 48) / GRID_SIZE);

const GEM_STYLES = {
  red:    { bg: '#FF3B55', shadow: '#FF0022', glow: '#FF6B80' },
  orange: { bg: '#FF8C00', shadow: '#CC6600', glow: '#FFB347' },
  yellow: { bg: '#FFD700', shadow: '#CC9900', glow: '#FFE84D' },
  green:  { bg: '#00C853', shadow: '#008C3A', glow: '#4DFF8E' },
  blue:   { bg: '#0088FF', shadow: '#0055CC', glow: '#4DB3FF' },
  purple: { bg: '#AA00FF', shadow: '#7700CC', glow: '#CC4DFF' },
};

const createRandomGem = () => COLORS[Math.floor(Math.random() * COLORS.length)];

const createBoard = () => {
  let board;
  do {
    board = Array.from({ length: GRID_SIZE }, () =>
      Array.from({ length: GRID_SIZE }, createRandomGem)
    );
  } while (findMatches(board).length > 0);
  return board;
};

function findMatches(board) {
  const matched = new Set();

  // Horizontal
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c <= GRID_SIZE - 3; c++) {
      const color = board[r][c];
      if (color && board[r][c + 1] === color && board[r][c + 2] === color) {
        let end = c + 2;
        while (end + 1 < GRID_SIZE && board[r][end + 1] === color) end++;
        for (let i = c; i <= end; i++) matched.add(`${r},${i}`);
      }
    }
  }

  // Vertical
  for (let c = 0; c < GRID_SIZE; c++) {
    for (let r = 0; r <= GRID_SIZE - 3; r++) {
      const color = board[r][c];
      if (color && board[r + 1][c] === color && board[r + 2][c] === color) {
        let end = r + 2;
        while (end + 1 < GRID_SIZE && board[end + 1][c] === color) end++;
        for (let i = r; i <= end; i++) matched.add(`${i},${c}`);
      }
    }
  }

  return [...matched].map(key => {
    const [r, c] = key.split(',').map(Number);
    return { r, c };
  });
}

function removeMatches(board, matches) {
  const newBoard = board.map(row => [...row]);
  matches.forEach(({ r, c }) => { newBoard[r][c] = null; });
  return newBoard;
}

function dropGems(board) {
  const newBoard = board.map(row => [...row]);
  for (let c = 0; c < GRID_SIZE; c++) {
    let empty = GRID_SIZE - 1;
    for (let r = GRID_SIZE - 1; r >= 0; r--) {
      if (newBoard[r][c] !== null) {
        newBoard[empty][c] = newBoard[r][c];
        if (empty !== r) newBoard[r][c] = null;
        empty--;
      }
    }
    for (let r = empty; r >= 0; r--) {
      newBoard[r][c] = createRandomGem();
    }
  }
  return newBoard;
}

function isAdjacent(r1, c1, r2, c2) {
  return (Math.abs(r1 - r2) === 1 && c1 === c2) ||
         (Math.abs(c1 - c2) === 1 && r1 === r2);
}

function swapGems(board, r1, c1, r2, c2) {
  const newBoard = board.map(row => [...row]);
  [newBoard[r1][c1], newBoard[r2][c2]] = [newBoard[r2][c2], newBoard[r1][c1]];
  return newBoard;
}

// Single gem component with scale animation
const Gem = React.memo(({ color, selected, onPress, row, col }) => {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const glowAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (selected) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
        ])
      ).start();
      Animated.spring(scaleAnim, { toValue: 1.15, useNativeDriver: true, tension: 200 }).start();
    } else {
      glowAnim.stopAnimation();
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 200 }).start();
    }
  }, [selected]);

  const gemStyle = GEM_STYLES[color];
  const size = GEM_SIZE - 4;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={styles.gemCell}
    >
      <Animated.View
        style={[
          styles.gemOuter,
          { width: size, height: size, borderRadius: size / 2 },
          selected && styles.selectedRing,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        {/* Gem body */}
        <View
          style={[
            styles.gemBody,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: gemStyle.bg,
              shadowColor: gemStyle.shadow,
            },
          ]}
        >
          {/* Specular highlight */}
          <View
            style={[
              styles.highlight,
              {
                width: size * 0.35,
                height: size * 0.2,
                borderRadius: size * 0.1,
                top: size * 0.12,
                left: size * 0.2,
              },
            ]}
          />
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
});

export default function App() {
  const [board, setBoard] = useState(() => createBoard());
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(MAX_MOVES);
  const [processing, setProcessing] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [message, setMessage] = useState('');

  const processBoard = useCallback(async (newBoard, addScore = 0) => {
    setProcessing(true);
    let currentBoard = newBoard;
    let totalScore = addScore;

    let matches = findMatches(currentBoard);
    while (matches.length > 0) {
      totalScore += matches.length * 10;
      currentBoard = removeMatches(currentBoard, matches);
      setBoard([...currentBoard]);
      await new Promise(r => setTimeout(r, 250));
      currentBoard = dropGems(currentBoard);
      setBoard([...currentBoard]);
      await new Promise(r => setTimeout(r, 200));
      matches = findMatches(currentBoard);
    }

    setScore(prev => prev + totalScore);
    setProcessing(false);
    return currentBoard;
  }, []);

  const handleGemPress = useCallback(async (row, col) => {
    if (processing || gameOver) return;

    if (!selected) {
      setSelected({ row, col });
      return;
    }

    const { row: sr, col: sc } = selected;

    if (sr === row && sc === col) {
      setSelected(null);
      return;
    }

    if (!isAdjacent(sr, sc, row, col)) {
      setSelected({ row, col });
      return;
    }

    // Attempt swap
    setSelected(null);
    const swapped = swapGems(board, sr, sc, row, col);
    const matches = findMatches(swapped);

    if (matches.length === 0) {
      // Invalid swap — animate back
      setBoard(swapped);
      setMessage('No match! ✗');
      await new Promise(r => setTimeout(r, 300));
      setBoard(board);
      setMessage('');
      return;
    }

    const newMoves = moves - 1;
    setMoves(newMoves);
    setMessage(`+${matches.length * 10} pts!`);
    setTimeout(() => setMessage(''), 800);

    await processBoard(swapped);

    if (newMoves <= 0) {
      setGameOver(true);
    }
  }, [board, selected, processing, gameOver, moves, processBoard]);

  const resetGame = () => {
    setBoard(createBoard());
    setSelected(null);
    setScore(0);
    setMoves(MAX_MOVES);
    setProcessing(false);
    setGameOver(false);
    setMessage('');
  };

  const movesPercent = moves / MAX_MOVES;
  const movesBarColor = movesPercent > 0.5 ? '#00C853' : movesPercent > 0.25 ? '#FFD700' : '#FF3B55';

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>💎 GEM BLAST</Text>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>SCORE</Text>
            <Text style={styles.statValue}>{score.toLocaleString()}</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statBox}>
            <Text style={styles.statLabel}>MOVES</Text>
            <Text style={[styles.statValue, { color: movesBarColor }]}>{moves}</Text>
            <View style={styles.movesTrack}>
              <View style={[styles.movesBar, { width: `${movesPercent * 100}%`, backgroundColor: movesBarColor }]} />
            </View>
          </View>
        </View>

        {/* Message toast */}
        <View style={styles.messageRow}>
          {message ? <Text style={styles.messageText}>{message}</Text> : null}
        </View>

        {/* Board */}
        <View style={styles.boardWrapper}>
          <View style={styles.board}>
            {board.map((row, r) => (
              <View key={r} style={styles.row}>
                {row.map((color, c) => (
                  color ? (
                    <Gem
                      key={`${r}-${c}`}
                      color={color}
                      selected={selected?.row === r && selected?.col === c}
                      onPress={() => handleGemPress(r, c)}
                      row={r}
                      col={c}
                    />
                  ) : (
                    <View key={`${r}-${c}`} style={[styles.gemCell, { width: GEM_SIZE, height: GEM_SIZE }]} />
                  )
                ))}
              </View>
            ))}
          </View>
        </View>

        {/* Game Over overlay */}
        {gameOver && (
          <View style={styles.overlay}>
            <View style={styles.gameOverCard}>
              <Text style={styles.gameOverTitle}>GAME OVER</Text>
              <Text style={styles.gameOverScore}>Final Score</Text>
              <Text style={styles.gameOverScoreValue}>{score.toLocaleString()}</Text>
              <TouchableOpacity style={styles.restartBtn} onPress={resetGame}>
                <Text style={styles.restartBtnText}>PLAY AGAIN</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0D0D1A',
  },
  container: {
    flex: 1,
    backgroundColor: '#0D0D1A',
    alignItems: 'center',
  },
  header: {
    paddingTop: 12,
    paddingBottom: 4,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 4,
    textShadowColor: '#AA00FF',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    marginHorizontal: 24,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#2A2A4A',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#2A2A4A',
    marginHorizontal: 16,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6060AA',
    letterSpacing: 2,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  movesTrack: {
    width: 80,
    height: 4,
    backgroundColor: '#2A2A4A',
    borderRadius: 2,
    marginTop: 4,
    overflow: 'hidden',
  },
  movesBar: {
    height: 4,
    borderRadius: 2,
  },
  messageRow: {
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFD700',
    letterSpacing: 1,
    textShadowColor: '#FF8C00',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  boardWrapper: {
    padding: 8,
    backgroundColor: '#12122A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A2A5A',
    marginHorizontal: 16,
    shadowColor: '#AA00FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  board: {
    flexDirection: 'column',
  },
  row: {
    flexDirection: 'row',
  },
  gemCell: {
    width: GEM_SIZE,
    height: GEM_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gemOuter: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedRing: {
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  gemBody: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 6,
    overflow: 'hidden',
  },
  highlight: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.45)',
    transform: [{ rotate: '-20deg' }],
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gameOverCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 24,
    padding: 36,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#AA00FF',
    shadowColor: '#AA00FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    minWidth: 240,
  },
  gameOverTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 4,
    marginBottom: 16,
  },
  gameOverScore: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6060AA',
    letterSpacing: 3,
    marginBottom: 4,
  },
  gameOverScoreValue: {
    fontSize: 48,
    fontWeight: '900',
    color: '#FFD700',
    letterSpacing: 2,
    marginBottom: 28,
    textShadowColor: '#FF8C00',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  restartBtn: {
    backgroundColor: '#AA00FF',
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#AA00FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
  },
  restartBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 3,
  },
});