const playerSelectionList = document.getElementById('player-selection-list');
const generateLeagueButton = document.getElementById('generate-league-button');
const leagueMatchesDiv = document.getElementById('league-matches');
const standingsDiv = document.getElementById('standings');
const groupSelectionDiv = document.getElementById('group-selection');
const generateAnnouncementButton = document.getElementById('generate-announcement-button');
const announcementOutput = document.getElementById('announcement-output');


let allPlayers = [];
let leagueState = {
    matches: [],
    results: {},
    matchCounter: 0,
    group: ''
};

// Firestoreからプレイヤーを取得
db.collection('players').orderBy('name', 'asc').get()
    .then((snapshot) => {
        allPlayers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // ランクの順序を定義
        const rankOrder = { 'S': 1, 'A': 2, 'B': 3, 'C': 4, 'None': 99 };

        // ランク順 > 名前順でソート
        allPlayers.sort((a, b) => {
            const rankA = a.rank || 'None';
            const rankB = b.rank || 'None';
            const valueA = rankOrder[rankA] || 99;
            const valueB = rankOrder[rankB] || 99;

            if (valueA !== valueB) {
                return valueA - valueB;
            }
            return a.name.localeCompare(b.name);
        });

        displayPlayerSelection(allPlayers);
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

function filterPlayersByGroup(selectedGroup) {
    const checkboxes = playerSelectionList.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        const player = allPlayers.find(p => p.id === checkbox.value);
        if (player) {
            checkbox.checked = selectedGroup === 'all' || player.rank === selectedGroup;
        }
    });
}

function displayPlayerSelection(players) {
    playerSelectionList.innerHTML = '';
    players.forEach(player => {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = player.id;
        checkbox.value = player.id;
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

function getSelectedPlayers() {
    const selectedIds = Array.from(playerSelectionList.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
    return allPlayers.filter(player => selectedIds.includes(player.id));
}

function getSelectedGroup() {
    const selectedRadio = groupSelectionDiv.querySelector('input[name="group"]:checked');
    return selectedRadio ? selectedRadio.value : '';
}

generateLeagueButton.addEventListener('click', () => {
    const selectedPlayers = getSelectedPlayers();
    if (selectedPlayers.length < 2) {
        alert('リーグ戦を作成するには、少なくとも2人のプレイヤーを選択してください。');
        return;
    }
    document.getElementById('player-selection-list').parentElement.style.display = 'none';
    groupSelectionDiv.style.display = 'none';
    generateLeagueButton.style.display = 'none';
    generateLeagueMatches(selectedPlayers, getSelectedGroup());
});

function generateLeagueMatches(players, group) {
    leagueState.group = group;
    leagueState.matches = generateAllRoundRobinMatches(players);
    displayLeagueMatches();
    updateStandings(players);
}

function generateAllRoundRobinMatches(players) {
    const allMatches = [];
    let matchCounter = 0;

    let participants = [...players];
    participants.sort(() => Math.random() - 0.5);
    // プレイヤーが奇数の場合、ダミーの「不戦勝」プレイヤーを追加
    if (participants.length % 2 !== 0) {
        participants.push({ name: "BYE", id: "BYE" });
    }

    const numRounds = participants.length - 1;
    const halfSize = participants.length / 2;

    for (let round = 0; round < numRounds; round++) {
        for (let i = 0; i < halfSize; i++) {
            const player1 = participants[i];
            const player2 = participants[participants.length - 1 - i];

            // 不戦勝のマッチは含めない
            if (player1.name !== "BYE" && player2.name !== "BYE") {
                matchCounter++;
                const matchNumber = (leagueState.group && leagueState.group !== 'all') ? `${leagueState.group}${matchCounter}` : `${matchCounter}`;
                allMatches.push({
                    round: round + 1,
                    matchNumber: matchNumber,
                    player1: player1,
                    player2: player2,
                    winner: null,
                    scores: { player1: 0, player2: 0 },
                    finished: false
                });
            }
        }

        // プレイヤーをローテーション（最初の一人は固定）
        const lastPlayer = participants.pop();
        participants.splice(1, 0, lastPlayer);
    }

    return allMatches;
}

function displayLeagueMatches() {
    leagueMatchesDiv.innerHTML = '';
    let currentRound = 0;

    leagueState.matches.forEach((match, index) => {
        if (match.round !== currentRound) {
            currentRound = match.round;
            const roundHeader = document.createElement('h3');
            roundHeader.textContent = `ラウンド ${currentRound}`;
            leagueMatchesDiv.appendChild(roundHeader);
        }
        const matchDiv = createLeagueMatchElement(match, index);
        leagueMatchesDiv.appendChild(matchDiv);
    });
}

function createLeagueMatchElement(match, index) {
    const matchDiv = document.createElement('div');
    matchDiv.classList.add('match');
    if (match.finished) {
        matchDiv.classList.add('match-finished');
    }

    const playersDiv = document.createElement('div');
    playersDiv.classList.add('match-players');

    const matchNumberSpan = document.createElement('span');
    matchNumberSpan.classList.add('match-number');
    matchNumberSpan.textContent = `${match.matchNumber}: `;
    playersDiv.appendChild(matchNumberSpan);

    const playerNamesSpan = document.createElement('span');
    playerNamesSpan.textContent = `${match.player1.name} vs ${match.player2.name}`;
    playersDiv.appendChild(playerNamesSpan);

    const resultDiv = document.createElement('div');
    resultDiv.classList.add('match-result');

    if (!match.finished) {
        const scoreControl1 = createScoreControl();
        const scoreControl2 = createScoreControl();

        const registerBtn = document.createElement('button');
        registerBtn.textContent = '結果登録';
        registerBtn.onclick = () => {
            const score1 = parseInt(scoreControl1.querySelector('.score-input').value, 10);
            const score2 = parseInt(scoreControl2.querySelector('.score-input').value, 10);
            if (score1 === score2) {
                alert('引き分けはサポートされていません。勝敗を明確にしてください。');
                return;
            }
            const winner = score1 > score2 ? match.player1 : match.player2;
            const loser = score1 > score2 ? match.player2 : match.player1;
            recordLeagueResult(index, winner, loser, { player1: score1, player2: score2 });
            
            const updatedMatchDiv = createLeagueMatchElement(leagueState.matches[index], index);
            matchDiv.parentElement.replaceChild(updatedMatchDiv, matchDiv);

            updateStandings(getSelectedPlayers());
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

function createScoreControl() {
    const scoreControl = document.createElement('div');
    scoreControl.classList.add('score-control');
    const minusBtn = document.createElement('button');
    minusBtn.textContent = '-';
    minusBtn.classList.add('score-btn');
    const scoreInput = document.createElement('input');
    scoreInput.type = 'number';
    scoreInput.min = 0;
    scoreInput.value = 0;
    scoreInput.classList.add('score-input');
    const plusBtn = document.createElement('button');
    plusBtn.textContent = '+';
    plusBtn.classList.add('score-btn');

    minusBtn.onclick = () => { scoreInput.value = Math.max(0, parseInt(scoreInput.value) - 1); };
    plusBtn.onclick = () => { scoreInput.value = parseInt(scoreInput.value) + 1; };

    scoreControl.appendChild(minusBtn);
    scoreControl.appendChild(scoreInput);
    scoreControl.appendChild(plusBtn);
    return scoreControl;
}

function recordLeagueResult(index, winner, loser, scores) {
    const match = leagueState.matches[index];
    match.winner = winner.name;
    match.loser = loser.name;
    match.scores = scores;
    match.finished = true;
}

function updateStandings(players) {
    const playerStats = {};

    players.forEach(player => {
        playerStats[player.name] = { games: 0, wins: 0, losses: 0, scoreDiff: 0, rank: player.rank || 'None' };
    });

    leagueState.matches.forEach(match => {
        if (match.finished) {
            const winnerName = match.winner;
            const loserName = match.loser;
            const winnerStats = playerStats[winnerName];
            const loserStats = playerStats[loserName];

            if (winnerStats) {
                winnerStats.wins++;
                winnerStats.games++;
                const score1 = match.scores.player1;
                const score2 = match.scores.player2;
                winnerStats.scoreDiff += Math.abs(score1 - score2);
            }
            if (loserStats) {
                loserStats.losses++;
                loserStats.games++;
                const score1 = match.scores.player1;
                const score2 = match.scores.player2;
                loserStats.scoreDiff -= Math.abs(score1 - score2);
            }
        }
    });

    const sortedPlayers = Object.keys(playerStats).sort((a, b) => {
        const statsA = playerStats[a];
        const statsB = playerStats[b];
        if (statsB.wins !== statsA.wins) return statsB.wins - statsA.wins;
        if (statsB.scoreDiff !== statsA.scoreDiff) return statsB.scoreDiff - statsA.scoreDiff;
        return statsA.losses - statsB.losses;
    });

    const tableBody = document.querySelector('#standings-table tbody');
    tableBody.innerHTML = '';

    sortedPlayers.forEach((playerName, index) => {
        const stats = playerStats[playerName];
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${playerName}</td>
            <td>${stats.games}</td>
            <td>${stats.wins}</td>
            <td>${stats.losses}</td>
            <td>${stats.scoreDiff}</td>
        `;
        tableBody.appendChild(row);
    });
}

generateAnnouncementButton.addEventListener('click', () => {
    let announcementText = '@大会参加者 試合を行ってください。\nラウンド内の試合が終われば、指示を待たず次のラウンドに進んでください。\n';
    let currentRound = 0;

    leagueState.matches.forEach(match => {
        // 新しいラウンドのヘッダーを追加
        if (match.round !== currentRound) {
            currentRound = match.round;
            announcementText += `\n### ラウンド ${currentRound} \n`;
        }
        // 試合情報を追加
        announcementText += `あいことば ${match.matchNumber} ${match.player1.name} vs ${match.player2.name}\n`;
    });

    // 末尾の余分な改行を削除
    announcementOutput.value = announcementText.trim();
});

firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        db.collection('users').doc(user.uid).get()
            .then((doc) => {
                if (doc.exists && doc.data().isAdmin) {
                    document.body.classList.add('admin-logged-in');
                } else {
                    document.body.classList.remove('admin-logged-in');
                }
            })
            .catch((error) => {
                console.error("管理者ステータスの確認エラー:", error);
                document.body.classList.remove('admin-logged-in');
            });
    } else {
        document.body.classList.remove('admin-logged-in');
    }
});