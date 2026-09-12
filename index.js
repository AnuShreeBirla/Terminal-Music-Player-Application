import fs from "fs";
import audio from "audio";

// -----------------------------
// READ SONGS
// -----------------------------

const path = "./songs";

const songs = fs
  .readdirSync(path)
  .filter((el) => el.endsWith(".mp3"));


// -----------------------------
// PLAYER STATE
// -----------------------------

let selected = 0;

let currentAudio = null;
let currentSongIndex = null;

let isPlaying = false;
let isPaused = false;

let renderStarted = false;

let playerId = 0;

// Number of lines in current render
let renderedLines = 0;


// -----------------------------
// START
// -----------------------------

process.stdin.setEncoding("utf-8");
process.stdin.setRawMode(true);
process.stdin.resume();

showSongs();


// -----------------------------
// KEYBOARD INPUT
// -----------------------------

process.stdin.on("data", async (input) => {

  // Quit
  if (input === "q" || input === "Q" || input === "\u0003") {
    quitPlayer();
    return;
  }


  // ---------------------------
  // UP ARROW
  // ---------------------------

  if (input[2] === "A") {

    if (selected === 0) return;

    selected = selected - 1;

    showSongs();
    return;
  }


  // ---------------------------
  // DOWN ARROW
  // ---------------------------

  if (input[2] === "B") {

    if (selected === songs.length - 1) return;

    selected = selected + 1;

    showSongs();
    return;
  }


  // ---------------------------
  // ENTER
  // ---------------------------

  if (input === "\r" || input === "\n") {
    await handleEnter();
  }


  // ---------------------------
  // SPACE
  // ---------------------------

  if (input === " ") {
    if (currentAudio) {
      if (currentAudio.paused) {
        currentAudio.resume();
      } else if (currentAudio.playing) {
        currentAudio.pause();
      }

      showSongs();
    }
  }
});


// =====================================================
// ENTER HANDLER
// =====================================================

async function handleEnter() {

  // --------------------------------
  // Same song is currently playing
  // --------------------------------

  if (
    currentAudio &&
    currentSongIndex === selected
  ) {

    // Pause
    if (currentAudio.playing) {

      currentAudio.pause();

      isPlaying = false;
      isPaused = true;

      showSongs();

      return;
    }


    // Resume
    if (currentAudio.paused) {

      currentAudio.resume();

      isPlaying = true;
      isPaused = false;

      showSongs();

      return;
    }
  }


  // --------------------------------
  // Different song
  // --------------------------------

  await playSong(selected);
}


// =====================================================
// PLAY SONG
// =====================================================

async function playSong(index) {

  // Stop previous song completely
  stopCurrentSong();


  currentSongIndex = index;

  const songPath = `${path}/${songs[index]}`;

  const myPlayerId = ++playerId;


  try {

    currentAudio = audio(songPath);

    // Wait until the MP3 has been decoded
    await currentAudio.ready;


    // --------------------------------
    // Prevent stale player
    // --------------------------------

    if (myPlayerId !== playerId) {

      currentAudio.stop();
      currentAudio.dispose();

      return;
    }


    isPlaying = true;
    isPaused = false;


    // --------------------------------
    // Update progress
    // --------------------------------

    currentAudio.on("timeupdate", () => {

      // Ignore an old song's event
      if (myPlayerId !== playerId) return;

      showSongs();
    });


    // --------------------------------
    // Song finished
    // --------------------------------

    currentAudio.on("ended", () => {

      if (myPlayerId !== playerId) return;


      isPlaying = false;
      isPaused = false;

      showSongs();
    });


    // --------------------------------
    // Start playback
    // --------------------------------

    currentAudio.play();

    showSongs();

  } catch (error) {

    console.log("\nError playing song:", error.message);

    currentAudio = null;
    currentSongIndex = null;

    isPlaying = false;
    isPaused = false;

    showSongs();
  }
}


// =====================================================
// STOP CURRENT SONG
// =====================================================

function stopCurrentSong() {

  // Invalidate old player callbacks
  playerId++;


  if (currentAudio) {

    try {
      currentAudio.stop();
    } catch (error) {
      // Ignore stop errors
    }


    try {
      currentAudio.dispose();
    } catch (error) {
      // Ignore dispose errors
    }
  }


  currentAudio = null;
  currentSongIndex = null;

  isPlaying = false;
  isPaused = false;
}


// =====================================================
// RENDER SONG LIST
// =====================================================

function showSongs() {

  let output = "";


  // --------------------------------
  // Header
  // --------------------------------

  output += "🎶 MUSIC PLAYER 🎶\n\n";


  // --------------------------------
  // Songs
  // --------------------------------

  for (let i = 0; i < songs.length; i++) {

    if (selected === i) {

      output += `-> ${i + 1}: ${removeExtension(songs[i])}\n`;

    } else {

      output += `   ${i + 1}: ${removeExtension(songs[i])}\n`;
    }
  }


  // --------------------------------
  // Player information
  // --------------------------------

  output += "\n";


  if (currentAudio && currentSongIndex !== null) {

    const songName = removeExtension(
      songs[currentSongIndex]
    );


    let symbol = "▶";

    if (currentAudio.paused) {
      symbol = "⏸";
    }


    output += `${symbol} ${songName}\n`;


    const currentTime = currentAudio.currentTime || 0;

    const duration = currentAudio.duration || 0;


    output += `${formatTime(currentTime)} / ${formatTime(duration)}\n`;


    output += createProgressBar(
      currentTime,
      duration
    );

  } else {

    output += "No song playing\n";
    output += "00:00 / 00:00\n";
    output += createProgressBar(0, 0);
  }


  // --------------------------------
  // Controls
  // --------------------------------

  output += "\n";
  output += "↑ ↓  Navigate    Enter  Play/Pause    Q  Quit\n";


  // --------------------------------
  // Redraw in place
  // --------------------------------

  redraw(output);
}


// =====================================================
// REDRAW TERMINAL
// =====================================================

function redraw(output) {

  if (renderStarted) {

    /*
      Move cursor up by the number of lines
      that were printed during the previous render.
    */

    process.stdout.write(`\x1b[${renderedLines}A`);
  }


  // Clear screen from cursor down
  process.stdout.write("\x1b[J");


  process.stdout.write(output);


  renderedLines = output.split("\n").length - 1;

  renderStarted = true;
}


// =====================================================
// PROGRESS BAR
// =====================================================

function createProgressBar(currentTime, duration) {

  const width = 40;


  if (!duration || duration <= 0) {

    return `[${"-".repeat(width)}] 0%`;
  }


  let percentage =
    (currentTime / duration) * 100;


  // Keep percentage between 0 and 100
  percentage = Math.max(
    0,
    Math.min(100, percentage)
  );


  const filled =
    Math.round((percentage / 100) * width);


  const empty = width - filled;


  return (
    `[${"█".repeat(filled)}${"-".repeat(empty)}] ` +
    `${Math.floor(percentage)}%`
  );
}


// =====================================================
// FORMAT TIME
// =====================================================

function formatTime(seconds) {

  if (!seconds || !Number.isFinite(seconds)) {
    return "00:00";
  }


  seconds = Math.floor(seconds);


  const minutes = Math.floor(seconds / 60);

  const remainingSeconds = seconds % 60;


  return (
    String(minutes).padStart(2, "0") +
    ":" +
    String(remainingSeconds).padStart(2, "0")
  );
}


// =====================================================
// REMOVE .MP3
// =====================================================

function removeExtension(song) {

  return song.replace(/\.mp3$/i, "");
}


// =====================================================
// QUIT
// =====================================================

function quitPlayer() {

  // Stop audio and invalidate callbacks
  stopCurrentSong();


  // Restore normal terminal input
  process.stdin.setRawMode(false);
  process.stdin.pause();


  // Move cursor to a clean line
  process.stdout.write("\n");


  process.exit(0);
}