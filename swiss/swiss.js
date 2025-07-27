const playerSelectionList = document.getElementById('player-selection-list');
const generateSwissButton = document.getElementById('generate-swiss-button');
const swissMatchesDiv = document.getElementById('swiss-matches');
const standingsDiv = document.getElementById('standings');
const nextRoundButton = document.getElementById('next-round-button');
const groupSelectionDiv = document.getElementById('group-selection');

let allPlayers = [];
let swissState = {
    players: [], // 参加プレイヤーの勝敗などを管理
    currentRound: 0,
    matches: [], // 現在のラウンドの試合
    matchCounter: 0, // スイスドロー内のマッチカウンター
    maxRounds: 0 // 新しく追加: 最大ラウンド数
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
    if (!playerSelectionList) {
        return;
    }
    playerSelectionList.innerHTML = '';
    if (players.length === 0) {
        playerSelectionList.textContent = "プレイヤーが登録されていません。トップページでプレイヤーを登録してください。";
        return;
    }
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

// スイスドロー生成ボタンのクリックイベント
generateSwissButton.addEventListener('click', () => {
    const selectedPlayers = getSelectedPlayers();
    if (selectedPlayers.length < 2) {
        alert('スイスドローを作成するには、少なくとも2人のプレイヤーを選択してください。');
        return;
    }
    // スイスドローは奇数人数でも開始できるように変更
    // if (selectedPlayers.length % 2 !== 0) {
    //     alert('スイスドローは偶数人数のプレイヤーで開始してください。');
    //     return;
    // }

    // プレイヤー選択エリアを非表示にする
    const playerSelectionContainer = document.getElementById('player-selection-list').parentElement;
    if (playerSelectionContainer) {
        playerSelectionContainer.style.display = 'none';
    }
    groupSelectionDiv.style.display = 'none';
    generateInitialSwissRound(selectedPlayers, getSelectedGroup());
});

// Helper to check if player1 has already played player2
function hasPlayed(player1Obj, player2Name) {
    return player1Obj.opponents.includes(player2Name);
}

// 初回スイスドローラウンドの生成
function generateInitialSwissRound(players, group) {
    // プレイヤーの状態を初期化
    swissState.players = players.map(name => ({
        name: name,
        wins: 0,
        losses: 0,
        draws: 0,
        points: 0, // 勝利1, 引き分け1, 敗北0
        omw: 0, // OMW%
        sop: 0, // Sum of Opponent's Points
        aoomw: 0, // Average of Opponent's OMW
        opponents: [], // 対戦相手の履歴
        wonAgainst: [], // 勝利した対戦相手の履歴
        matchPlayed: false, // そのラウンドで試合をしたか
        hasBye: false,
        games: 0 // 試合数
    }));
    swissState.currentRound = 0;
    swissState.matchCounter = 0;

    // 最大ラウンド数を設定 (例: 参加者数に応じて調整)
    // ここでは仮に、参加者数4人なら3ラウンド、8人なら4ラウンド、16人なら5ラウンドなど
    // Math.ceil(Math.log2(players.length)) + 1; // 参加者数が多い場合にラウンド数を増やす
    swissState.maxRounds = Math.max(3, Math.ceil(Math.log2(players.length)) + 1); // 最低3ラウンド

    generateNextSwissRound(group);
}

// 次のスイスドローラウンドを生成
function generateNextSwissRound(group) {
    // 最大ラウンド数に達したら終了
    if (swissState.currentRound >= swissState.maxRounds) {
        swissMatchesDiv.innerHTML = `<h3>大会終了！最終順位</h3>`;
        nextRoundButton.style.display = 'none';
        updateSwissStandings();
        return;
    }

    swissState.currentRound++;
    swissMatchesDiv.innerHTML = `<h3>ラウンド ${swissState.currentRound}</h3>`;
    swissState.matches = [];
    swissState.matchCounter = 0; // ラウンドごとにリセット

    // 1. プレイヤーをポイント順にソート (降順)
    const sortedPlayers = [...swissState.players].sort((a, b) => b.points - a.points);

    const unpairedPlayers = [...sortedPlayers];
    const currentRoundMatches = [];

    // 2. 不戦勝の処理 (奇数人数の場合)
    if (unpairedPlayers.length % 2 !== 0) {
        // まだ不戦勝になっていない最もポイントの低いプレイヤーを探す
        let byeCandidateIndex = -1;
        for (let i = unpairedPlayers.length - 1; i >= 0; i--) {
            if (!unpairedPlayers[i].hasBye) {
                byeCandidateIndex = i;
                break;
            }
        }

        let byePlayer;
        if (byeCandidateIndex !== -1) {
            byePlayer = unpairedPlayers.splice(byeCandidateIndex, 1)[0];
        } else {
            // 全員不戦勝を経験済みの場合、最もポイントの低いプレイヤーに再度不戦勝
            byePlayer = unpairedPlayers.pop();
        }

        if (byePlayer) {
            byePlayer.wins++;
            byePlayer.points += 1; // 不戦勝で1ポイント
            byePlayer.hasBye = true; // 不戦勝を経験したとマーク
            byePlayer.matchPlayed = true; // このラウンドで試合をしたとマーク
            byePlayer.games++; // 試合数をインクリメント
            // console.log(`${byePlayer.name} が不戦勝です。`); // デバッグログ削除
            // 不戦勝の試合も表示したい場合は、matchオブジェクトを作成してcurrentRoundMatchesに追加
            swissState.matchCounter++;
            const matchNumber = group ? `${group}${swissState.matchCounter}` : `${swissState.matchCounter}`;
            currentRoundMatches.push({
                matchNumber: matchNumber,
                player1: byePlayer.name,
                player2: "不戦勝",
                winner: byePlayer.name,
                scores: { player1: '-', player2: '-' },
                finished: true
            });
        }
    }

    // 3. プレイヤーのペアリング
    while (unpairedPlayers.length > 0) {
        const player1 = unpairedPlayers.shift(); // 最もポイントの高い未ペアリングプレイヤー

        let paired = false;
        // まだ対戦していない相手の中で、最もポイントが近い相手を探す
        // (ここでは単純にリストの先頭から探す)
        for (let i = 0; i < unpairedPlayers.length; i++) {
            const player2 = unpairedPlayers[i];

            if (!hasPlayed(player1, player2.name) && !hasPlayed(player2, player1.name)) {
                swissState.matchCounter++;
                const matchNumber = group ? `${group}${swissState.matchCounter}` : `${swissState.matchCounter}`;
                const match = {
                    matchNumber: matchNumber,
                    player1: player1.name,
                    player2: player2.name,
                    winner: null,
                    scores: { player1: 0, player2: 0 },
                    finished: false
                };
                currentRoundMatches.push(match);

                player1.matchPlayed = true;
                player2.matchPlayed = true;

                unpairedPlayers.splice(i, 1); // player2を未ペアリングリストから削除
                paired = true;
                break; // player1のペアリングが完了したので次のplayer1へ
            }
        }

        // フォールバック: まだ対戦していない相手が見つからない場合
        if (!paired && unpairedPlayers.length > 0) {
            const player2 = unpairedPlayers.shift(); // 次の利用可能なプレイヤーとペアリング
            swissState.matchCounter++;
            const matchNumber = group ? `${group}${swissState.matchCounter}` : `${swissState.matchCounter}`;
            const match = {
                matchNumber: matchNumber,
                player1: player1.name,
                player2: player2.name,
                winner: null,
                scores: { player1: 0, player2: 0 },
                finished: false
            };
            currentRoundMatches.push(match);

            player1.matchPlayed = true;
            player2.matchPlayed = true;
            // console.warn(`再戦が発生しました: ${player1.name} vs ${player2.name}。より高度なペアリングロジックを検討してください。`); // デバッグログ削除
        }
    }

    swissState.matches = currentRoundMatches;
    displaySwissMatches();
    updateSwissStandings();
    nextRoundButton.style.display = 'none'; // 次のラウンドボタンを非表示
}

// スイスドローの試合を表示
function displaySwissMatches() {
    swissMatchesDiv.innerHTML = '';
    if (swissState.matches.length === 0) {
        return;
    }
    swissState.matches.forEach((match, index) => {
        const matchDiv = createSwissMatchElement(match, index);
        swissMatchesDiv.appendChild(matchDiv);
    });
}

// スイスドローの試合要素を作成
function createSwissMatchElement(match, index) {
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
    matchNumberSpan.textContent = `${match.matchNumber}: `;
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
            const winnerName = score1 > score2 ? match.player1 : match.player2;
            const loserName = score1 > score2 ? match.player2 : match.player1;
            recordSwissResult(index, winnerName, loserName, { player1: score1, player2: score2 });
            
            // 試合要素を更新
            const updatedMatchDiv = createSwissMatchElement(swissState.matches[index], index);
            matchDiv.parentElement.replaceChild(updatedMatchDiv, matchDiv);

            updateSwissStandings(); // 順位表を更新
            checkSwissRoundCompletion();
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

// スイスドローの結果を記録
function recordSwissResult(index, winnerName, loserName, scores) {
    const match = swissState.matches[index];
    match.winner = winnerName;
    match.loser = loserName;
    match.scores = scores;
    match.finished = true;

    // プレイヤーの勝敗を更新
    const winnerPlayer = swissState.players.find(p => p.name === winnerName);
    const loserPlayer = swissState.players.find(p => p.name === loserName);

    if (winnerPlayer) {
        winnerPlayer.wins++;
        winnerPlayer.points += 1;
        winnerPlayer.games++;
        winnerPlayer.opponents.push(loserName);
        winnerPlayer.wonAgainst.push(loserName); // 勝利した相手を記録
    }
    if (loserPlayer) {
        loserPlayer.losses++;
        loserPlayer.games++;
        loserPlayer.opponents.push(winnerName);
    }
}

// OMW%, SoP, AoOMW などのタイブレーク指標を計算する
function calculateTiebreakers() {
    // まず全プレイヤーのOMW%を計算する
    swissState.players.forEach(player => {
        if (player.opponents.length === 0) {
            player.omw = 0;
            return;
        }

        let opponentWinPercentages = [];
        player.opponents.forEach(opponentName => {
            const opponent = swissState.players.find(p => p.name === opponentName);
            if (opponent) {
                const opponentWinPercentage = opponent.games > 0 ? opponent.wins / opponent.games : 0;
                opponentWinPercentages.push(Math.max(0.33, opponentWinPercentage));
            }
        });

        if (opponentWinPercentages.length > 0) {
            const sum = opponentWinPercentages.reduce((a, b) => a + b, 0);
            player.omw = sum / opponentWinPercentages.length;
        } else {
            player.omw = 0;
        }
    });

    // 次に、計算済みのOMW%を使ってSoPとAoOMWを計算する
    swissState.players.forEach(player => {
        let totalOpponentPoints = 0;
        let totalOpponentOmw = 0;
        let opponentCount = 0;

        player.wonAgainst.forEach(opponentName => { // wonAgainst を使用
            const opponent = swissState.players.find(p => p.name === opponentName);
            if (opponent) {
                totalOpponentPoints += opponent.points;
            }
        });

        player.opponents.forEach(opponentName => {
            const opponent = swissState.players.find(p => p.name === opponentName);
            if (opponent) {
                totalOpponentOmw += opponent.omw;
                opponentCount++;
            }
        });

        player.sop = totalOpponentPoints; // SoPを更新

        if (opponentCount > 0) {
            player.aoomw = totalOpponentOmw / opponentCount;
        } else {
            player.aoomw = 0;
        }
    });
}

// スイスドローの順位表を更新
function updateSwissStandings() {
    calculateTiebreakers(); // すべてのタイブレーク指標を計算

    // プレイヤーを勝利数、OMW%、SoP, AoOMWでソート
    const sortedPlayers = [...swissState.players].sort((a, b) => {
        // 1. 勝利数でソート (降順)
        if (b.wins !== a.wins) {
            return b.wins - a.wins;
        }
        // 2. OMW%でソート (降順)
        if (b.omw !== a.omw) {
            return b.omw - a.omw;
        }
        // 3. 対戦相手の勝ち点合計 (SoP) でソート (降順)
        if (b.sop !== a.sop) {
            return b.sop - a.sop;
        }
        // 4. 対戦相手のOMW%平均 (AoOMW) でソート (降順)
        return b.aoomw - a.aoomw;
    });

    // 順位表を表示
    const tableBody = document.querySelector('#standings-table tbody');
    tableBody.innerHTML = '';

    if (sortedPlayers.length === 0) {
        return;
    }

    let currentRank = 1;
    for (let i = 0; i < sortedPlayers.length; i++) {
        const player = sortedPlayers[i];
        const row = document.createElement('tr');

        // 同位タイの処理
        const isTie = i > 0 &&
                      player.wins === sortedPlayers[i - 1].wins &&
                      player.omw === sortedPlayers[i - 1].omw &&
                      player.sop === sortedPlayers[i - 1].sop &&
                      player.aoomw === sortedPlayers[i - 1].aoomw;

        if (isTie) {
            // 前のプレイヤーと同位の場合、同じ順位番号を表示
            row.innerHTML = `
                <td>${currentRank}</td>
                <td>${player.name}</td>
                <td>${player.games}</td>
                <td>${player.wins}</td>
                <td>${player.losses}</td>
                <td class="details-col">${(player.omw * 100).toFixed(2)}%</td>
                <td class="details-col">${player.sop}</td>
                <td class="details-col">${(player.aoomw * 100).toFixed(2)}%</td>
            `;
        } else {
            // 新しい順位の場合
            currentRank = i + 1;
            row.innerHTML = `
                <td>${currentRank}</td>
                <td>${player.name}</td>
                <td>${player.games}</td>
                <td>${player.wins}</td>
                <td>${player.losses}</td>
                <td class="details-col">${(player.omw * 100).toFixed(2)}%</td>
                <td class="details-col">${player.sop}</td>
                <td class="details-col">${(player.aoomw * 100).toFixed(2)}%</td>
            `;
        }
        tableBody.appendChild(row);
    }
}

// ラウンドの全試合が終了したかチェック
function checkSwissRoundCompletion() {
    const allMatchesFinished = swissState.matches.every(match => match.finished);
    if (allMatchesFinished) {
        nextRoundButton.style.display = 'block'; // 次のラウンドボタンを表示
    }
}

// 次のラウンドへボタンのクリックイベント
nextRoundButton.addEventListener('click', () => {
    // プレイヤーのmatchPlayedフラグをリセット
    swissState.players.forEach(p => p.matchPlayed = false);
    generateNextSwissRound(getSelectedGroup());
});

// 詳細表示ボタンのイベントリスナー
const toggleDetailsButton = document.getElementById('toggle-details-button');
const standingsTable = document.getElementById('standings-table');

toggleDetailsButton.addEventListener('click', () => {
    standingsTable.classList.toggle('show-details');
    if (standingsTable.classList.contains('show-details')) {
        toggleDetailsButton.textContent = '詳細を隠す';
    } else {
        toggleDetailsButton.textContent = '詳細を表示';
    }
});

// アナウンス生成ボタンのイベントリスナー
const generateAnnouncementButton = document.getElementById('generate-announcement-button');
const announcementOutput = document.getElementById('announcement-output');

generateAnnouncementButton.addEventListener('click', () => {
    let announcementText = `@大会参加者 試合を開始してください。
    ラウンド${swissState.currentRound}
`;
    swissState.matches.forEach(match => {
        // 不戦勝の試合はアナウンスに含めない
        if (match.player2 !== "不戦勝") {
            announcementText += `あいことば ${match.matchNumber} ${match.player1} vs ${match.player2}
`;
        }
    });
    announcementOutput.value = announcementText;
});

// 認証状態の変更を監視してUIを更新
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        // ログインしているユーザーが管理者かどうかを確認
        db.collection('users').doc(user.uid).get()
            .then((doc) => {
                if (doc.exists && doc.data().isAdmin) {
                    // 管理者の場合
                    document.body.classList.add('admin-logged-in');
                } else {
                    // 管理者ではない場合
                    document.body.classList.remove('admin-logged-in');
                }
            })
            .catch((error) => {
                console.error("管理者ステータスの確認エラー:", error);
                document.body.classList.remove('admin-logged-in');
            });
    } else {
        // ログアウトしている場合
        document.body.classList.remove('admin-logged-in');
    }
});