const playerSelectionList = document.getElementById('player-selection-list');
const generateLeagueButton = document.getElementById('generate-league-button');
const leagueMatchesDiv = document.getElementById('league-matches');
const standingsDiv = document.getElementById('standings');

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

// リーグ戦生成ボタンのクリックイベント
generateLeagueButton.addEventListener('click', () => {
    const selectedPlayers = getSelectedPlayers();
    if (selectedPlayers.length < 2) {
        alert('リーグ戦を作成するには、少なくとも2人のプレイヤーを選択してください。');
        return;
    }
    // プレイヤー選択エリアを非表示にする
    document.getElementById('player-selection-list').parentElement.style.display = 'none';
    generateLeagueMatches(selectedPlayers);
});

// リーグ戦の組み合わせを生成
function generateLeagueMatches(players) {
    leagueState.matches = [];
    // リーグ戦内のマッチカウンターをリセット
    leagueState.matchCounter = 0;

    for (let i = 0; i < players.length; i++) {
        for (let j = i + 1; j < players.length; j++) {
            leagueState.matchCounter++; // マッチ番号をインクリメント
            leagueState.matches.push({
                matchNumber: 200 + leagueState.matchCounter, // 200番台のマッチ番号を割り当て
                player1: players[i],
                player2: players[j],
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
    matchNumberSpan.textContent = `マッチ ${match.matchNumber}: `; // #を削除
    playersDiv.appendChild(matchNumberSpan);

    const playerNamesSpan = document.createElement('span');
    playerNamesSpan.textContent = `${match.player1} vs ${match.player2}`;
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
            recordLeagueResult(index, winner, loser, { player1: score1, player2: score2 });
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

// 順位表を更新
function updateStandings() {
    const playerStats = {};

    // 全プレイヤーを初期化
    getSelectedPlayers().forEach(player => {
        playerStats[player] = { wins: 0, losses: 0, points: 0 };
    });

    // 試合結果に基づいて統計を更新
    leagueState.matches.forEach(match => {
        if (match.finished) {
            playerStats[match.winner].wins++;
            playerStats[match.winner].points += 3; // 勝利で3ポイント
            playerStats[match.loser].losses++;
        }
    });

    // 統計をソート
    const sortedPlayers = Object.keys(playerStats).sort((a, b) => {
        // ポイントでソート
        if (playerStats[b].points !== playerStats[a].points) {
            return playerStats[b].points - playerStats[a].points;
        }
        // 勝利数でソート
        return playerStats[b].wins - playerStats[a].wins;
    });

    // 順位表を表示
    standingsDiv.innerHTML = '';
    const table = document.createElement('table');
    table.innerHTML = `
        <thead>
            <tr>
                <th>順位</th>
                <th>プレイヤー</th>
                <th>勝</th>
                <th>敗</th>
                <th>ポイント</th>
            </tr>
        </thead>
        <tbody>
        </tbody>
    `;
    const tbody = table.querySelector('tbody');

    sortedPlayers.forEach((player, index) => {
        const stats = playerStats[player];
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${player}</td>
            <td>${stats.wins}</td>
            <td>${stats.losses}</td>
            <td>${stats.points}</td>
        `;
        tbody.appendChild(row);
    });
    standingsDiv.appendChild(table);
}
