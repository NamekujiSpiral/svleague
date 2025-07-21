const playerSelectionList = document.getElementById('player-selection-list');
const generateTournamentButton = document.getElementById('generate-tournament-button');
const tournamentBracket = document.getElementById('tournament-bracket');
const groupSelectionDiv = document.getElementById('group-selection');

let allPlayers = [];
let tournamentState = {
    rounds: [],
    currentRound: 0,
    matchCounter: 0 // トーナメント内のマッチカウンター
};

// Firestoreからプレイヤーを取得して選択リストを表示
db.collection('players').orderBy('name', 'asc').get()
    .then((snapshot) => {
        allPlayers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        displayPlayerSelection(allPlayers);
    })
    .catch(error => {
        console.error("プレイヤーの読み込みエラー:", error);
    });

// プレイヤー選択リストの表示
function displayPlayerSelection(players) {
    playerSelectionList.innerHTML = '';
    players.forEach(player => {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = player.id;
        checkbox.value = player.name;
        checkbox.checked = true;

        const label = document.createElement('label');
        label.htmlFor = player.id;
        label.textContent = player.name;

        const div = document.createElement('div');
        div.appendChild(checkbox);
        div.appendChild(label);
        playerSelectionList.appendChild(div);
    });
}

// 選択されたプレイヤーを取得
function getSelectedPlayers() {
    const selected = [];
    const checkboxes = playerSelectionList.querySelectorAll('input[type="checkbox"]:checked');
    checkboxes.forEach(checkbox => {
        selected.push(checkbox.value);
    });
    return selected;
}

// 選択されたグループを取得
function getSelectedGroup() {
    const selectedRadio = groupSelectionDiv.querySelector('input[name="group"]:checked');
    return selectedRadio ? selectedRadio.value : '';
}

// トーナメント生成ボタンのクリックイベント
generateTournamentButton.addEventListener('click', () => {
    const selectedPlayers = getSelectedPlayers();
    if (selectedPlayers.length < 2) {
        alert('トーナメントを作成するには、少なくとも2人のプレイヤーを選択してください。');
        return;
    }
    // プレイヤー選択エリアとグループ選択エリアを非表示にする
    document.getElementById('player-selection-list').parentElement.style.display = 'none';
    groupSelectionDiv.style.display = 'none';
    generateInitialTournament(selectedPlayers, getSelectedGroup());
});

// 初回トーナメント生成
function generateInitialTournament(players, group) {
    const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);

    let nextPowerOfTwo = Math.pow(2, Math.ceil(Math.log2(shuffledPlayers.length)));
    while (shuffledPlayers.length < nextPowerOfTwo) {
        shuffledPlayers.push('不戦勝');
    }

    // トーナメント内のマッチカウンターをリセット
    tournamentState.matchCounter = 0;

    const firstRoundMatches = [];
    for (let i = 0; i < shuffledPlayers.length; i += 2) {
        tournamentState.matchCounter++; // マッチ番号をインクリメント
        const matchNumber = group ? `${group}${tournamentState.matchCounter}` : `${tournamentState.matchCounter}`;
        firstRoundMatches.push({
            matchNumber: matchNumber,
            player1: shuffledPlayers[i],
            player2: shuffledPlayers[i + 1],
            winner: null,
            scores: { player1: 0, player2: 0 }
        });
    }

    tournamentState.rounds = [{ matches: firstRoundMatches }];
    tournamentState.currentRound = 0;

    displayCurrentRound();
}

// 現在のラウンドを表示
function displayCurrentRound() {
    const roundIndex = tournamentState.currentRound;
    const round = tournamentState.rounds[roundIndex];

    const roundDiv = document.createElement('div');
    roundDiv.classList.add('round');
    const h3 = document.createElement('h3');
    h3.textContent = `ラウンド ${roundIndex + 1}`;
    roundDiv.appendChild(h3);

    round.matches.forEach((match, matchIndex) => {
        const matchDiv = createMatchElement(match, roundIndex, matchIndex);
        roundDiv.appendChild(matchDiv);

        // 不戦勝の試合は自動的に結果を処理
        if (match.player1 === '不戦勝' || match.player2 === '不戦勝') {
            const winner = match.player1 === '不戦勝' ? match.player2 : match.player1;
            recordResult(roundIndex, matchIndex, winner);
            // 表示を更新
            const updatedMatchDiv = createMatchElement(tournamentState.rounds[roundIndex].matches[matchIndex], roundIndex, matchIndex);
            roundDiv.replaceChild(updatedMatchDiv, matchDiv);
        }
    });

    tournamentBracket.appendChild(roundDiv);
    checkRoundCompletion();
}

// 試合要素の作成
function createMatchElement(match, roundIndex, matchIndex) {
    const matchDiv = document.createElement('div');
    matchDiv.classList.add('match');
    if (match.winner) {
        matchDiv.classList.add('match-finished');
    }

    const playersDiv = document.createElement('div');
    playersDiv.classList.add('match-players');

    // マッチ番号を表示
    const matchNumberSpan = document.createElement('span');
    matchNumberSpan.classList.add('match-number');
    matchNumberSpan.textContent = `${match.matchNumber}: `; // #を削除
    playersDiv.appendChild(matchNumberSpan);

    // Player 1
    const player1Span = document.createElement('span');
    player1Span.textContent = match.player1;
    if (match.winner === match.player1) player1Span.classList.add('winner-player');

    // Player 2
    const player2Span = document.createElement('span');
    player2Span.textContent = match.player2;
    if (match.winner === match.player2) player2Span.classList.add('winner-player');

    const vsSpan = document.createElement('span');
    vsSpan.textContent = ' vs ';

    playersDiv.appendChild(player1Span);
    playersDiv.appendChild(vsSpan);
    playersDiv.appendChild(player2Span);

    // 結果入力エリア
    const resultDiv = document.createElement('div');
    resultDiv.classList.add('match-result');

    if (!match.winner && match.player1 !== '不戦勝' && match.player2 !== '不戦勝') {
        // スコアコントロールコンテナ
        const scoreControl1 = document.createElement('div');
        scoreControl1.classList.add('score-control');
        const minusBtn1 = document.createElement('button');
        minusBtn1.textContent = '-';
        minusBtn1.classList.add('score-btn');
        const score1Input = document.createElement('input');
        score1Input.type = 'number';
        score1Input.min = 0;
        score1Input.value = 0;
        score1Input.classList.add('score-input');
        const plusBtn1 = document.createElement('button');
        plusBtn1.textContent = '+';
        plusBtn1.classList.add('score-btn');

        minusBtn1.onclick = () => { score1Input.value = Math.max(0, parseInt(score1Input.value) - 1); };
        plusBtn1.onclick = () => { score1Input.value = parseInt(score1Input.value) + 1; };

        scoreControl1.appendChild(minusBtn1);
        scoreControl1.appendChild(score1Input);
        scoreControl1.appendChild(plusBtn1);

        const scoreControl2 = document.createElement('div');
        scoreControl2.classList.add('score-control');
        const minusBtn2 = document.createElement('button');
        minusBtn2.textContent = '-';
        minusBtn2.classList.add('score-btn');
        const score2Input = document.createElement('input');
        score2Input.type = 'number';
        score2Input.min = 0;
        score2Input.value = 0;
        score2Input.classList.add('score-input');
        const plusBtn2 = document.createElement('button');
        plusBtn2.textContent = '+';
        plusBtn2.classList.add('score-btn');

        minusBtn2.onclick = () => { score2Input.value = Math.max(0, parseInt(score2Input.value) - 1); };
        plusBtn2.onclick = () => { score2Input.value = parseInt(score2Input.value) + 1; };

        scoreControl2.appendChild(minusBtn2);
        scoreControl2.appendChild(score2Input);
        scoreControl2.appendChild(plusBtn2);

        const registerBtn = document.createElement('button');
        registerBtn.textContent = '結果登録';
        registerBtn.onclick = () => {
            const score1 = parseInt(score1Input.value, 10);
            const score2 = parseInt(score2Input.value, 10);
            if (score1 === score2) {
                alert('勝利数が同じです。勝敗を明確にしてください。');
                return;
            }
            const winner = score1 > score2 ? match.player1 : match.player2;
            recordResult(roundIndex, matchIndex, winner, { player1: score1, player2: score2 });
            
            // 表示を更新
            const updatedMatchDiv = createMatchElement(tournamentState.rounds[roundIndex].matches[matchIndex], roundIndex, matchIndex);
            matchDiv.parentElement.replaceChild(updatedMatchDiv, matchDiv);
        };

        resultDiv.appendChild(scoreControl1);
        resultDiv.appendChild(document.createTextNode(' - '));
        resultDiv.appendChild(scoreControl2);
        resultDiv.appendChild(registerBtn);
    } else {
        resultDiv.textContent = `結果: ${match.scores.player1} - ${match.scores.player2}`;
    }

    matchDiv.appendChild(playersDiv);
    matchDiv.appendChild(resultDiv);

    return matchDiv;
}

// 結果を記録
function recordResult(roundIndex, matchIndex, winner, scores = { player1: 0, player2: 0 }) {
    const match = tournamentState.rounds[roundIndex].matches[matchIndex];
    match.winner = winner;
    match.scores = scores;
    if (match.player1 === '不戦勝' || match.player2 === '不戦勝') {
        match.scores = { player1: '-', player2: '-'};
    }
    checkRoundCompletion();
}

// ラウンドの全試合が終了したかチェック
function checkRoundCompletion() {
    const currentRound = tournamentState.rounds[tournamentState.currentRound];
    const allMatchesFinished = currentRound.matches.every(match => match.winner !== null);

    if (allMatchesFinished) {
        const winners = currentRound.matches.map(match => match.winner);
        if (winners.length > 1) {
            // 次のラウンドへ
            generateNextRound(winners, getSelectedGroup());
        } else {
            // 優勝者決定
            displayWinner(winners[0]);
        }
    }
}

// 次のラウンドを生成
function generateNextRound(winners, group) {
    const nextRoundMatches = [];
    for (let i = 0; i < winners.length; i += 2) {
        tournamentState.matchCounter++; // マッチ番号をインクリメント
        const matchNumber = group ? `${group}${tournamentState.matchCounter}` : `${tournamentState.matchCounter}`;
        nextRoundMatches.push({
            matchNumber: matchNumber,
            player1: winners[i],
            player2: winners[i + 1],
            winner: null,
            scores: { player1: 0, player2: 0 }
        });
    }
    tournamentState.rounds.push({ matches: nextRoundMatches });
    tournamentState.currentRound++;
    displayCurrentRound();
}

// 優勝者を表示
function displayWinner(winnerName) {
    const winnerDiv = document.createElement('div');
    winnerDiv.classList.add('winner');
    winnerDiv.innerHTML = `<h3>優勝</h3><p>${winnerName}</p>`;
    tournamentBracket.appendChild(winnerDiv);
}