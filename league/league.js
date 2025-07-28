const playerSelectionList = document.getElementById('player-selection-list');
const generateLeagueButton = document.getElementById('generate-league-button');
const leagueMatchesDiv = document.getElementById('league-matches');
const standingsDiv = document.getElementById('standings');
const groupSelectionDiv = document.getElementById('group-selection');

let allPlayers = [];
let leagueState = {
    matches: [],
    results: {},
    matchCounter: 0 // リーグ戦内のマッチカウンター
};

// Firestoreからプレイヤーを取得して選択リストを表示
db.collection('players').orderBy('name', 'asc').get()
    .then((snapshot) => {
        allPlayers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        displayPlayerSelection(allPlayers);
        // 初期表示時に「すべて」のプレイヤーをチェック
        filterPlayersByGroup('all');
    })
    .catch(error => {
        console.error("プレイヤーの読み込みエラー:", error);
    });

// グループ選択の変更を監視
groupSelectionDiv.addEventListener('change', (event) => {
    if (event.target.name === 'group') {
        filterPlayersByGroup(event.target.value);
    }
});

// グループに基づいてプレイヤーをフィルタリングし、チェックボックスの状態を更新する関数
function filterPlayersByGroup(selectedGroup) {
    const checkboxes = playerSelectionList.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        const player = allPlayers.find(p => p.id === checkbox.value);
        if (player) {
            if (selectedGroup === 'all') {
                checkbox.checked = true;
            } else if (player.rank === selectedGroup) {
                checkbox.checked = true;
            } else {
                checkbox.checked = false;
            }
        }
    });
}

// プレイヤー選択リストの表示
function displayPlayerSelection(players) {
    playerSelectionList.innerHTML = '';
    players.forEach(player => {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = player.id;
        checkbox.value = player.id; // IDを値として使用
        checkbox.checked = true;

        const label = document.createElement('label');
        label.htmlFor = player.id;
        label.textContent = `[${player.rank || 'None'}] ${player.name}`;

        const div = document.createElement('div');
        div.appendChild(checkbox);
        div.appendChild(label);
        playerSelectionList.appendChild(div);
    });
}

// 選択されたプレイヤーを取得
function getSelectedPlayers() {
    const selectedIds = [];
    const checkboxes = playerSelectionList.querySelectorAll('input[type="checkbox"]:checked');
    checkboxes.forEach(checkbox => {
        selectedIds.push(checkbox.value);
    });
    // allPlayersから選択されたIDに一致する完全なプレイヤーオブジェクトを返す
    return allPlayers.filter(player => selectedIds.includes(player.id));
}

// 選択されたグループを取得
function getSelectedGroup() {
    const selectedRadio = groupSelectionDiv.querySelector('input[name="group"]:checked');
    return selectedRadio ? selectedRadio.value : '';
}

// リーグ戦生成ボタンのクリックイベント
generateLeagueButton.addEventListener('click', () => {
    const selectedPlayers = getSelectedPlayers();
    if (selectedPlayers.length < 2) {
        alert('リーグ戦を作成するには、少なくとも2人のプレイヤーを選択してください。');
        return;
    }
    // プレイヤー選択エリアとグループ選択エリアを非表示にする
    document.getElementById('player-selection-list').parentElement.style.display = 'none';
    groupSelectionDiv.style.display = 'none';
    generateLeagueMatches(selectedPlayers, getSelectedGroup());
});

// リーグ戦の組み合わせを生成
function generateLeagueMatches(players, group) {
    leagueState.matches = [];
    // リーグ戦内のマッチカウンターをリセット
    leagueState.matchCounter = 0;

    for (let i = 0; i < players.length; i++) {
        for (let j = i + 1; j < players.length; j++) {
            leagueState.matchCounter++; // マッチ番号をインクリメント
            const matchNumber = (group && group !== 'all') ? `${group}${leagueState.matchCounter}` : `${leagueState.matchCounter}`;
            leagueState.matches.push({
                matchNumber: matchNumber,
                player1: players[i], // プレイヤーオブジェクト全体を格納
                player2: players[j], // プレイヤーオブジェクト全体を格納
                winner: null,
                scores: { player1: 0, player2: 0 },
                finished: false
            });
        }
    }
    displayLeagueMatches();
    updateStandings();
}

// リーグ戦の試合を表示
function displayLeagueMatches() {
    leagueMatchesDiv.innerHTML = '';
    leagueState.matches.forEach((match, index) => {
        const matchDiv = createLeagueMatchElement(match, index);
        leagueMatchesDiv.appendChild(matchDiv);
    });
}

// リーグ戦の試合要素を作成
function createLeagueMatchElement(match, index) {
    const matchDiv = document.createElement('div');
    matchDiv.classList.add('match');
    if (match.finished) {
        matchDiv.classList.add('match-finished');
    }

    const playersDiv = document.createElement('div');
    playersDiv.classList.add('match-players');

    // マッチ番号を表示
    const matchNumberSpan = document.createElement('span');
    matchNumberSpan.classList.add('match-number');
    matchNumberSpan.textContent = `${match.matchNumber}: `; // #を削除
    playersDiv.appendChild(matchNumberSpan);

    const playerNamesSpan = document.createElement('span');
    const player1Display = match.player1.name;
    const player2Display = match.player2.name;

    playerNamesSpan.textContent = `${player1Display} vs ${player2Display}`;
    playersDiv.appendChild(playerNamesSpan);

    const resultDiv = document.createElement('div');
    resultDiv.classList.add('match-result');

    if (!match.finished) {
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
                alert('引き分けはサポートされていません。勝敗を明確にしてください。');
                return;
            }
            const winner = score1 > score2 ? match.player1 : match.player2;
            const loser = score1 > score2 ? match.player2 : match.player1;
            recordLeagueResult(index, winner.name, loser.name, { player1: score1, player2: score2 });
            displayLeagueMatches(); // UIを更新
            updateStandings(); // 順位表を更新
        };

        resultDiv.appendChild(scoreControl1);
        resultDiv.appendChild(document.createTextNode(' - '));
        resultDiv.appendChild(scoreControl2);
        resultDiv.appendChild(registerBtn);
    } else {
        resultDiv.textContent = `結果: ${match.scores.player1} - ${match.scores.player2} (${match.winner}の勝利)`;
    }

    matchDiv.appendChild(playersDiv);
    matchDiv.appendChild(resultDiv);

    return matchDiv;
}

// リーグ戦の結果を記録
function recordLeagueResult(index, winner, loser, scores) {
    const match = leagueState.matches[index];
    match.winner = winner;
    match.loser = loser;
    match.scores = scores;
    match.finished = true;
}

function updateStandings() {
    const playerStats = {};

    // 全プレイヤーを初期化
    getSelectedPlayers().forEach(player => {
        playerStats[player.name] = { games: 0, wins: 0, losses: 0, scoreDiff: 0, rank: player.rank || 'None' };
    });

    // 試合結果に基づいて統計を更新
    leagueState.matches.forEach(match => {
        if (match.finished) {
            playerStats[match.winner].wins++;
            playerStats[match.winner].games++;
            playerStats[match.loser].losses++;
            playerStats[match.loser].games++;

            // 得失点差の計算
            const winnerScore = match.scores.player1 > match.scores.player2 ? match.scores.player1 : match.scores.player2;
            const loserScore = match.scores.player1 > match.scores.player2 ? match.scores.player2 : match.scores.player1;

            playerStats[match.winner].scoreDiff += (winnerScore - loserScore);
            playerStats[match.loser].scoreDiff -= (winnerScore - loserScore);
        }
    });

    // 統計をソート
    const sortedPlayers = Object.keys(playerStats).sort((a, b) => {
        const statsA = playerStats[a];
        const statsB = playerStats[b];

        // 勝利数でソート
        if (statsB.wins !== statsA.wins) {
            return statsB.wins - statsA.wins;
        }
        // 得失点差でソート
        if (statsB.scoreDiff !== statsA.scoreDiff) {
            return statsB.scoreDiff - statsA.scoreDiff;
        }
        // 敗戦数でソート
        return statsA.losses - statsB.losses;
    });

    // 順位表を表示
    const tableBody = document.querySelector('#standings-table tbody');
    tableBody.innerHTML = '';

    sortedPlayers.forEach((player, index) => {
        const stats = playerStats[player];
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${player}</td>
            <td>${stats.games}</td>
            <td>${stats.wins}</td>
            <td>${stats.losses}</td>
            <td>${stats.scoreDiff}</td>
        `;
        tableBody.appendChild(row);
    });
}
