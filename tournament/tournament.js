document.addEventListener('DOMContentLoaded', () => {
    const playerSelectionList = document.getElementById('player-selection-list');
    const generateTournamentButton = document.getElementById('generate-tournament-button');
    const groupSelectionDiv = document.getElementById('group-selection');
    const matchListDiv = document.getElementById('match-list');
    const tournamentBracketDiv = document.getElementById('tournament-bracket');

    const playerSelectionContainer = document.getElementById('player-selection-container');
    const matchResultsContainer = document.getElementById('match-results-container');
    const tournamentBracketContainer = document.getElementById('tournament-bracket-container');

    let allPlayers = [];
    let tournamentState = {};

    // Firestoreからプレイヤーを取得
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

    // グループ選択の変更イベント
    groupSelectionDiv.addEventListener('change', () => {
        const selectedGroup = groupSelectionDiv.querySelector('input[name="group"]:checked').value;
        const filteredPlayers = selectedGroup ? allPlayers.filter(p => p.group === selectedGroup) : allPlayers;
        displayPlayerSelection(filteredPlayers);
    });

    // トーナメント生成ボタンのクリックイベント
    generateTournamentButton.addEventListener('click', () => {
        const selectedPlayers = Array.from(playerSelectionList.querySelectorAll('input[type="checkbox"]:checked'))
                                     .map(cb => cb.value);

        if (selectedPlayers.length < 2) {
            alert('トーナメントを作成するには、少なくとも2人のプレイヤーを選択してください。');
            return;
        }

        // UIの表示切り替え
        playerSelectionContainer.style.display = 'none';
        matchResultsContainer.style.display = 'block';
        tournamentBracketContainer.style.display = 'block';

        initializeTournament(selectedPlayers);
        renderAll();
    });

    // トーナメント構造を初期化
    function initializeTournament(players) {
        const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
        const totalPlayers = Math.pow(2, Math.ceil(Math.log2(shuffledPlayers.length)));
        const byes = totalPlayers - shuffledPlayers.length;

        // 1回戦のプレイヤーリストを作成（不戦勝を含む）
        let firstRoundPlayers = [...shuffledPlayers];
        for (let i = 0; i < byes; i++) {
            // 不戦勝を戦略的に配置（強いプレイヤーが不戦勝になりにくいようにシャッフル後のリストの後ろに追加）
            firstRoundPlayers.push('不戦勝');
        }

        tournamentState = {
            rounds: [],
            players: players
        };

        let currentPlayers = firstRoundPlayers;
        let roundIndex = 0;

        while (currentPlayers.length > 1) {
            const round = { matches: [] };
            for (let i = 0; i < currentPlayers.length; i += 2) {
                const match = {
                    id: `r${roundIndex}m${i/2}`,
                    player1: currentPlayers[i],
                    player2: currentPlayers[i+1],
                    winner: null,
                    roundIndex: roundIndex
                };
                // 不戦勝の処理
                if (match.player1 === '不戦勝') match.winner = match.player2;
                if (match.player2 === '不戦勝') match.winner = match.player1;
                round.matches.push(match);
            }
            tournamentState.rounds.push(round);
            
            // 次のラウンドのプレイヤーリストを準備
            const winners = round.matches.map(m => m.winner); // この時点では不戦勝の勝者のみ
            currentPlayers = winners;
            roundIndex++;
        }
        // 優勝者ラウンドを追加
        tournamentState.rounds.push({ matches: [{ id: `r${roundIndex}m0`, player1: null, winner: null, roundIndex: roundIndex }] });
    }

    // 全体を描画（結果入力とトーナメント表）
    function renderAll() {
        updateTournamentState();
        renderMatchInputs();
        renderTournamentBracket();
    }

    // トーナメントの状態を更新（勝者を次のラウンドへ）
    function updateTournamentState() {
        for (let i = 0; i < tournamentState.rounds.length - 1; i++) {
            const currentRound = tournamentState.rounds[i];
            const nextRound = tournamentState.rounds[i + 1];

            for (let j = 0; j < nextRound.matches.length; j++) {
                const matchForP1 = currentRound.matches[j * 2];
                const matchForP2 = currentRound.matches[j * 2 + 1];

                const p1 = matchForP1 ? matchForP1.winner : null;
                const p2 = matchForP2 ? matchForP2.winner : null;

                nextRound.matches[j].player1 = p1;
                nextRound.matches[j].player2 = p2;

                // 勝者が決まっていたが、前のラウンドの勝者が変更されて対戦相手が不在になった場合、勝者をリセットする
                if (!p1 || !p2) {
                    nextRound.matches[j].winner = null;
                }
            }
        }
        // 最終ラウンド（優勝者）の更新
        const finalRound = tournamentState.rounds[tournamentState.rounds.length - 2];
        if (finalRound && finalRound.matches.length === 1 && finalRound.matches[0].winner) {
            const winner = finalRound.matches[0].winner;
            const winnerBox = tournamentState.rounds[tournamentState.rounds.length - 1].matches[0];
            winnerBox.winner = winner;
            winnerBox.player1 = winner; // 表示用にplayer1にも名前を入れる
        } else {
            const winnerBox = tournamentState.rounds[tournamentState.rounds.length - 1].matches[0];
            winnerBox.winner = null;
            winnerBox.player1 = null;
        }
    }

    // 結果入力エリアを描画
    function renderMatchInputs() {
        matchListDiv.innerHTML = '';
        let roundHasUnfinishedMatches = false;

        for (const round of tournamentState.rounds) {
            for (const match of round.matches) {
                // 勝者が決まっておらず、対戦相手が両方いる試合のみ表示
                if (!match.winner && match.player1 && match.player2 && match.player1 !== '不戦勝' && match.player2 !== '不戦勝') {
                    roundHasUnfinishedMatches = true;
                    matchListDiv.appendChild(createMatchInputElement(match));
                }
            }
            // 未完了の試合があるラウンドを見つけたら、それ以降のラウンドは表示しない
            if (roundHasUnfinishedMatches) break;
        }

        // 全ての試合が終わったら優勝者を表示
        if (!roundHasUnfinishedMatches && tournamentState.rounds.length > 0) {
            const winnerName = tournamentState.rounds[tournamentState.rounds.length - 1].matches[0].winner;
            if (winnerName) {
                matchListDiv.innerHTML = `<div class="winner"><h3>優勝: ${winnerName}</h3></div>`;
            }
        }
    }

    // 結果入力用の対戦要素を作成
    function createMatchInputElement(match) {
        const matchDiv = document.createElement('div');
        matchDiv.classList.add('match');

        const playersDiv = document.createElement('div');
        playersDiv.classList.add('match-players');
        playersDiv.textContent = `${match.player1} vs ${match.player2}`;
        matchDiv.appendChild(playersDiv);

        const resultDiv = document.createElement('div');
        resultDiv.classList.add('match-result');

        const scoreControl1 = createScoreControl();
        const scoreControl2 = createScoreControl();

        const registerBtn = document.createElement('button');
        registerBtn.textContent = '結果登録';
        registerBtn.onclick = () => {
            const score1 = parseInt(scoreControl1.querySelector('.score-input').value, 10);
            const score2 = parseInt(scoreControl2.querySelector('.score-input').value, 10);

            if (score1 === score2) {
                alert('勝利数が同じです。勝敗を明確にしてください。');
                return;
            }
            // matchオブジェクトに直接勝者を設定
            match.winner = score1 > score2 ? match.player1 : match.player2;
            // 全体を再描画
            renderAll();
        };

        resultDiv.appendChild(scoreControl1);
        resultDiv.appendChild(document.createTextNode(' - '));
        resultDiv.appendChild(scoreControl2);
        resultDiv.appendChild(registerBtn);

        matchDiv.appendChild(resultDiv);
        return matchDiv;
    }

    // スコア入力コントロールを作成するヘルパー関数
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

    // トーナメント表を描画
    function renderTournamentBracket() {
        tournamentBracketDiv.innerHTML = '';
        tournamentBracketDiv.className = 'tournament-bracket';

        tournamentState.rounds.forEach((round, roundIndex) => {
            const roundDiv = document.createElement('div');
            roundDiv.className = 'round';

            round.matches.forEach(match => {
                const matchDiv = document.createElement('div');
                matchDiv.className = 'match';

                // 1回戦以外はmatch-wrapperで囲む
                if (roundIndex > 0 && round.matches.length > 0 && !(roundIndex === tournamentState.rounds.length -1) ) {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'match-wrapper';
                    wrapper.appendChild(createPlayerDiv(match.player1, match.winner));
                    wrapper.appendChild(createPlayerDiv(match.player2, match.winner));
                    matchDiv.appendChild(wrapper);
                } else if (roundIndex === tournamentState.rounds.length -1) { // 優勝者ボックス
                     matchDiv.classList.add('winner-box');
                     matchDiv.appendChild(createPlayerDiv(match.winner, match.winner));
                } else { // 1回戦
                    matchDiv.classList.add('first-round-match'); // <--- クラスを追加
                    matchDiv.appendChild(createPlayerDiv(match.player1, match.winner));
                    matchDiv.appendChild(createPlayerDiv(match.player2, match.winner));
                }
                roundDiv.appendChild(matchDiv);
            });
            tournamentBracketDiv.appendChild(roundDiv);
        });
    }

    // プレイヤー要素を作成
    function createPlayerDiv(playerName, winnerName) {
        const playerDiv = document.createElement('div');
        const nameContainer = document.createElement('div');
        nameContainer.className = 'player-name-container';
        nameContainer.textContent = playerName || '---';
        
        playerDiv.className = 'player';
        if (playerName === '不戦勝') {
            playerDiv.classList.add('bye');
        }
        if (playerName && playerName === winnerName) {
            playerDiv.classList.add('winner');
        }
        playerDiv.appendChild(nameContainer);
        return playerDiv;
    }
});
