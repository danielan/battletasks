document.addEventListener('DOMContentLoaded', () => {
    initGame();
});

const ROWS = 7;
const COLS = ['A', 'B', 'C'];
const TOTAL_CELLS = ROWS * COLS.length;

let playerGrid = []; // Array of { id, type: 'ocean'|'task', content, state: 'hidden'|'hit'|'miss' }
let opponentGrid = []; // Array of { id, state: 'unknown'|'hit'|'miss' }
let gameState = 'setup'; // 'setup', 'playing'
let currentTurn = 'any'; // 'player' (opponent firing), 'opponent' (player firing), 'any' (first turn)
let gameOver = false;

function initGame() {
    loadData();
    updateGameStatus("Prepare your fleet... Drag tasks to position.");
    renderAll();
    setupEventListeners();
}

function loadData() {
    const storedPlayer = localStorage.getItem('battletasks_player');
    const storedOpponent = localStorage.getItem('battletasks_opponent');

    if (storedPlayer) {
        playerGrid = JSON.parse(storedPlayer);
    } else {
        playerGrid = generateEmptyGrid(true);
    }

    if (storedOpponent) {
        opponentGrid = JSON.parse(storedOpponent);
    } else {
        opponentGrid = generateEmptyGrid(false);
    }
}

function generateEmptyGrid(isPlayer) {
    const grid = [];
    for (let r = 1; r <= ROWS; r++) {
        for (let c of COLS) {
            const id = `${c}${r}`;
            if (isPlayer) {
                grid.push({ id, type: 'ocean', content: '', state: 'hidden' });
            } else {
                grid.push({ id, state: 'unknown' });
            }
        }
    }
    return grid;
}

function renderAll() {
    renderGrid('player-grid', playerGrid, handlePlayerGridClick);
    renderGrid('opponent-grid', opponentGrid, handleOpponentGridClick);
    updateControls();
    updateTurnVisuals();
}

function updateTurnVisuals() {
    const playerGridEl = document.getElementById('player-grid');
    const opponentGridEl = document.getElementById('opponent-grid');
    const playerTerritory = document.getElementById('player-territory');
    const opponentTerritory = document.getElementById('opponent-territory');

    // Default: Reset
    playerGridEl.classList.remove('disabled');
    opponentGridEl.classList.remove('disabled');
    playerTerritory.classList.remove('active-turn');
    opponentTerritory.classList.remove('active-turn');

    if (gameState === 'playing' && !gameOver) {
        if (currentTurn === 'player') {
            playerGridEl.classList.add('disabled');
            opponentTerritory.classList.add('active-turn');
        } else if (currentTurn === 'opponent') {
            opponentGridEl.classList.add('disabled');
            playerTerritory.classList.add('active-turn');
        }
    } else if (gameState === 'setup') {
        opponentGridEl.classList.add('disabled');
    } else if (gameOver) {
        playerGridEl.classList.add('disabled');
        opponentGridEl.classList.add('disabled');
    }
}

function renderGrid(elementId, gridData, clickHandler) {
    const container = document.getElementById(elementId);
    container.innerHTML = '';

    gridData.forEach(cell => {
        const cellDiv = document.createElement('div');
        cellDiv.className = 'cell';
        cellDiv.dataset.id = cell.id;

        if (cell.state === 'hit') {
            cellDiv.classList.add('hit');
            cellDiv.innerHTML = 'ðŸ’¥';
        } else if (cell.state === 'miss') {
            cellDiv.classList.add('miss');
            cellDiv.innerHTML = 'ðŸŒŠ';
        } else if (cell.type === 'task' && elementId === 'player-grid') {
            cellDiv.classList.add('has-task');
            cellDiv.innerHTML = 'ðŸ“';

            if (gameState === 'setup' && cell.state === 'hidden') {
                cellDiv.draggable = true;
                cellDiv.addEventListener('dragstart', handleDragStart);
            }
        }

        if (gameState === 'setup' && elementId === 'player-grid' && cell.type === 'ocean') {
            cellDiv.addEventListener('dragover', handleDragOver);
            cellDiv.addEventListener('dragleave', handleDragLeave);
            cellDiv.addEventListener('drop', handleDrop);
        }

        cellDiv.addEventListener('click', () => clickHandler(cell));
        container.appendChild(cellDiv);
    });
}

let draggedCellId = null;

function handleDragStart(e) {
    draggedCellId = e.target.dataset.id;
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
    if (gameState !== 'setup') return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.target.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.target.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    e.target.classList.remove('drag-over');
    const targetId = e.target.dataset.id;

    if (draggedCellId && targetId && draggedCellId !== targetId) {
        moveTask(draggedCellId, targetId);
    }
}

function moveTask(fromId, toId) {
    const fromIndex = playerGrid.findIndex(c => c.id === fromId);
    const toIndex = playerGrid.findIndex(c => c.id === toId);

    if (fromIndex === -1 || toIndex === -1) return;

    const taskCell = playerGrid[fromIndex];
    const targetCell = playerGrid[toIndex];

    if (targetCell.type !== 'ocean') return;

    targetCell.type = 'task';
    targetCell.content = taskCell.content;

    taskCell.type = 'ocean';
    taskCell.content = '';

    saveData();
    renderAll();
}


/* --- Click Handlers --- */

function handlePlayerGridClick(cell) {
    if (gameState === 'setup') {
        openTaskModal(cell);
        return;
    }

    if (gameState === 'playing') {
        if (currentTurn === 'player') return;

        if (cell.state === 'hit' || cell.state === 'miss') {
            return;
        }

        resolvePlayerHit(cell);

        if (!gameOver) {
            currentTurn = 'player';
            updateGameStatus("Your Turn! Fire at the Opponent.");
            renderAll();
        }
    }
}

function resolvePlayerHit(cell) {
    let isHit = (cell.type === 'task');

    if (isHit) {
        cell.state = 'hit';
    } else {
        cell.state = 'miss';
    }

    saveData();

    // Check Game Over
    const remainingTasks = playerGrid.filter(c => c.type === 'task' && c.state !== 'hit').length;
    if (remainingTasks === 0) {
        gameOver = true;
        updateGameStatus("GAME OVER! Your fleet has been destroyed.");
    }

    renderAll();

    // Alert Logic with Queuing
    if (isHit) {
        showAlert("ðŸ’¥ BOOM!", `HIT! You must: ${cell.content}`, () => {
            // Callback triggers AFTER user accepts the hit
            if (gameOver) {
                showAlert("DEFEAT", "All your tasks have been hit! Game Over.");
            }
        });
    } else {
        showAlert("ðŸŒŠ SPLASH!", "Missed!");
    }
}

function handleOpponentGridClick(cell) {
    if (gameState !== 'playing') {
        return;
    }

    if (currentTurn === 'opponent') return;

    if (cell.state !== 'unknown') return;

    openConfirmModal(
        `Did you hit the opponent at ${cell.id}?`,
        () => { // YES - HIT
            cell.state = 'hit';
            finalizePlayerTurn();
        },
        () => { // NO - MISS
            cell.state = 'miss';
            finalizePlayerTurn();
        }
    );
}

function finalizePlayerTurn() {
    saveData();
    currentTurn = 'opponent';
    updateGameStatus("Opponent's Turn... Waiting for fire.");
    renderAll();
}


/* --- Game Flow Control --- */

function startNewGame() {
    const survivingTasks = playerGrid.filter(c => c.type === 'task' && c.state !== 'hit');

    playerGrid = generateEmptyGrid(true);
    opponentGrid = generateEmptyGrid(false);

    const totalCells = playerGrid.length;
    let indices = Array.from({ length: totalCells }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    let placedCount = 0;
    for (let taskCell of survivingTasks) {
        if (placedCount >= indices.length) break;
        const targetIndex = indices[placedCount];

        playerGrid[targetIndex].type = 'task';
        playerGrid[targetIndex].content = taskCell.content;
        playerGrid[targetIndex].state = 'hidden';
        placedCount++;
    }

    gameState = 'setup';
    gameOver = false;
    currentTurn = 'any';
    saveData();
    renderAll();
    updateGameStatus("New Game! Arrange your surviving fleet.");
}

function beginBattle() {
    const taskCount = playerGrid.filter(c => c.type === 'task').length;
    if (taskCount === 0) {
        alert("You have no tasks! Add some tasks by clicking any cell.");
        return;
    }
    gameState = 'playing';
    currentTurn = 'any';
    gameOver = false;
    renderAll();
    updateGameStatus("Battle Commenced! Who goes first? (Click any grid)");
}

function updateControls() {
    const newGameBtn = document.getElementById('new-game-btn');
    const beginBtn = document.getElementById('begin-battle-btn');

    if (gameState === 'setup') {
        newGameBtn.disabled = false;
        beginBtn.disabled = false;
    } else {
        newGameBtn.disabled = false;
        beginBtn.disabled = true;
    }
}


/* --- Modal Logic --- */

let confirmCallbackYes = null;
let confirmCallbackNo = null;
let alertCallback = null;

function openConfirmModal(msg, onYes, onNo) {
    document.getElementById('confirm-message').textContent = msg;
    document.getElementById('confirmation-modal').classList.remove('hidden');
    confirmCallbackYes = onYes;
    confirmCallbackNo = onNo;
}

function closeConfirmModal() {
    document.getElementById('confirmation-modal').classList.add('hidden');
    confirmCallbackYes = null;
    confirmCallbackNo = null;
}

function setupEventListeners() {
    document.getElementById('new-game-btn').addEventListener('click', startNewGame);
    document.getElementById('begin-battle-btn').addEventListener('click', beginBattle);

    document.getElementById('save-task-btn').addEventListener('click', saveTaskFromModal);
    document.getElementById('clear-task-btn').addEventListener('click', clearTaskFromModal);
    document.getElementById('cancel-task-btn').addEventListener('click', closeTaskModal);

    document.getElementById('confirm-yes-btn').addEventListener('click', () => {
        if (confirmCallbackYes) confirmCallbackYes();
        closeConfirmModal();
    });
    document.getElementById('confirm-no-btn').addEventListener('click', () => {
        if (confirmCallbackNo) confirmCallbackNo();
        closeConfirmModal();
    });

    document.getElementById('alert-ok-btn').addEventListener('click', () => {
        document.getElementById('alert-modal').classList.add('hidden');
        if (alertCallback) {
            const cb = alertCallback;
            alertCallback = null;
            cb();
        }
    });
}


/* --- Edit Mode & Task Management --- */

let currentEditingCellId = null;

function openTaskModal(cell) {
    currentEditingCellId = cell.id;
    const modal = document.getElementById('task-modal');
    document.getElementById('modal-coord').textContent = cell.id;
    document.getElementById('task-input').value = cell.content || '';
    modal.classList.remove('hidden');
}

function closeTaskModal() {
    document.getElementById('task-modal').classList.add('hidden');
    currentEditingCellId = null;
}

function saveTaskFromModal() {
    if (!currentEditingCellId) return;
    const content = document.getElementById('task-input').value.trim();
    const cellIndex = playerGrid.findIndex(c => c.id === currentEditingCellId);

    if (cellIndex !== -1) {
        if (content) {
            playerGrid[cellIndex].type = 'task';
            playerGrid[cellIndex].content = content;
        } else {
            playerGrid[cellIndex].type = 'ocean';
            playerGrid[cellIndex].content = '';
        }
    }
    saveData();
    renderAll();
    closeTaskModal();
}

function clearTaskFromModal() {
    if (!currentEditingCellId) return;
    const cellIndex = playerGrid.findIndex(c => c.id === currentEditingCellId);
    if (cellIndex !== -1) {
        playerGrid[cellIndex].type = 'ocean';
        playerGrid[cellIndex].content = '';
    }
    saveData();
    renderAll();
    closeTaskModal();
}

function showAlert(title, message, onClose = null) {
    document.getElementById('alert-title').textContent = title;
    document.getElementById('alert-message').textContent = message;
    document.getElementById('alert-modal').classList.remove('hidden');
    alertCallback = onClose;
}

function updateGameStatus(msg) {
    document.getElementById('game-status').textContent = msg;
}

function saveData() {
    localStorage.setItem('battletasks_player', JSON.stringify(playerGrid));
    localStorage.setItem('battletasks_opponent', JSON.stringify(opponentGrid));
}
