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

    // トーナメント生成ボタンのクリックイベント
    generateTournamentButton.addEventListener('click', () => {
        const selectedPlayers = Array.from(playerSelectionList.querySelectorAll('input[type="checkbox"]:checked'))
                                     .map(cb => cb.value);

        if (selectedPlayers.length < 2) {
            alert('トーナメントを作成するには、少なくとも2人のプレイヤーを選択してください。');
            return;
        }

        const selectedGroup = groupSelectionDiv.querySelector('input[name="group"]:checked').value;

        playerSelectionContainer.style.display = 'none';
        matchResultsContainer.style.display = 'block';
        tournamentBracketContainer.style.display = 'block';

        initializeTournament(selectedPlayers, selectedGroup);
        renderAll();

        // スクロール時に線を再描画
        const grid = tournamentBracketDiv.querySelector('.tournament-grid');
        if (grid) {
            grid.addEventListener('scroll', () => {
                requestAnimationFrame(drawBracketLines);
            });
        }
    });

    // トーナメント構造を初期化
    function initializeTournament(players, group) {
        const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
        const totalPlayers = Math.pow(2, Math.ceil(Math.log2(shuffledPlayers.length)));
        const byes = totalPlayers - shuffledPlayers.length;

        let firstRoundPlayers = [...shuffledPlayers];
        for (let i = 0; i < byes; i++) {
            firstRoundPlayers.splice(2*i,0,'不戦勝');
        }

        tournamentState = { rounds: [], players: players, group: group };

        let currentPlayers = firstRoundPlayers;
        let roundIndex = 0;
        let matchCounter = 0;

        while (currentPlayers.length >= 1) {
            const round = { matches: [] };
            if (currentPlayers.length === 1) { // 優勝者
                 round.matches.push({ id: `r${roundIndex}m0`, player1: currentPlayers[0], winner: currentPlayers[0], roundIndex: roundIndex });
                 tournamentState.rounds.push(round);
                 break;
            }
            for (let i = 0; i < currentPlayers.length; i += 2) {
                matchCounter++;
                const match = {
                    id: `r${roundIndex}m${i/2}`,
                    player1: currentPlayers[i],
                    player2: currentPlayers[i+1],
                    winner: null,
                    roundIndex: roundIndex,
                    group: group,
                    matchNumber: matchCounter
                };
                if (match.player1 === '不戦勝') match.winner = match.player2;
                if (match.player2 === '不戦勝') match.winner = match.player1;
                round.matches.push(match);
            }
            tournamentState.rounds.push(round);
            currentPlayers = round.matches.map(m => m.winner);
            roundIndex++;
        }
    }

    // 全体を描画
    function renderAll() {
        updateTournamentState();
        renderMatchInputs();
        renderTournamentBracket();
        // SVG描画はResizeObserverによってトリガーされる
    }

    // トーナメントの状態を更新
    function updateTournamentState() {
        for (let i = 0; i < tournamentState.rounds.length - 1; i++) {
            const currentRound = tournamentState.rounds[i];
            const nextRound = tournamentState.rounds[i + 1];
            for (let j = 0; j < nextRound.matches.length; j++) {
                const p1 = currentRound.matches[j * 2]?.winner;
                const p2 = currentRound.matches[j * 2 + 1]?.winner;
                nextRound.matches[j].player1 = p1;
                nextRound.matches[j].player2 = p2;
                if (!p1 || !p2) {
                    nextRound.matches[j].winner = null;
                }
            }
        }
        const finalRound = tournamentState.rounds[tournamentState.rounds.length - 1];
        const semiFinal = tournamentState.rounds[tournamentState.rounds.length - 2];
        if(semiFinal && semiFinal.matches.length === 1 && semiFinal.matches[0].winner){
             finalRound.matches[0].winner = semiFinal.matches[0].winner;
             finalRound.matches[0].player1 = semiFinal.matches[0].winner;
        }
    }

    // 結果入力エリアを描画
    function renderMatchInputs() {
        matchListDiv.innerHTML = '';
        let roundHasUnfinishedMatches = false;
        for (const round of tournamentState.rounds) {
            for (const match of round.matches) {
                if (!match.winner && match.player1 && match.player2 && match.player1 !== '不戦勝' && match.player2 !== '不戦勝') {
                    roundHasUnfinishedMatches = true;
                    matchListDiv.appendChild(createMatchInputElement(match));
                }
            }
            if (roundHasUnfinishedMatches) break;
        }
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

        const matchInfoSpan = document.createElement('span');
        matchInfoSpan.classList.add('match-number');
        matchInfoSpan.textContent = `${match.group ? match.group : ''}${match.matchNumber}: `;

        const playersDiv = document.createElement('div');
        playersDiv.classList.add('match-players');
        playersDiv.textContent = `${match.player1} vs ${match.player2}`;

        matchDiv.appendChild(matchInfoSpan);
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
            match.winner = score1 > score2 ? match.player1 : match.player2;
            renderAll();
        };
        resultDiv.appendChild(scoreControl1);
        resultDiv.appendChild(document.createTextNode(' - '));
        resultDiv.appendChild(scoreControl2);
        resultDiv.appendChild(registerBtn);
        matchDiv.appendChild(resultDiv);
        return matchDiv;
    }

    // スコア入力コントロールを作成
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

    // プレイヤー要素を作成
    function createPlayerDiv(playerName, winnerName) {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'player';
        if (playerName) {
            playerDiv.textContent = playerName;
        } else {
            playerDiv.innerHTML = '&nbsp;'; // プレースホルダー
        }
        if (playerName === '不戦勝') playerDiv.classList.add('bye');
        if (playerName && playerName === winnerName) playerDiv.classList.add('winner');
        return playerDiv;
    }

    // トーナメント表のHTML構造を生成
    function renderTournamentBracket() {
        tournamentBracketDiv.innerHTML = '';
        const grid = document.createElement('div');
        grid.className = 'tournament-grid';
        tournamentState.rounds.forEach((round, roundIndex) => {
            const roundDiv = document.createElement('div');
            roundDiv.className = 'round';
            round.matches.forEach(match => {
                const matchDiv = document.createElement('div');
                matchDiv.className = 'match';
                matchDiv.id = match.id;
                if (roundIndex === tournamentState.rounds.length - 1) {
                    matchDiv.classList.add('winner-box');
                    matchDiv.appendChild(createPlayerDiv(match.winner, match.winner));
                } else {
                    matchDiv.appendChild(createPlayerDiv(match.player1, match.winner));
                    matchDiv.appendChild(createPlayerDiv(match.player2, match.winner));
                }
                roundDiv.appendChild(matchDiv);
            });
            grid.appendChild(roundDiv);
        });
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'bracket-svg-overlay');
        grid.appendChild(svg); // SVGをgridの中に入れる
        tournamentBracketDiv.appendChild(grid);

        // ResizeObserverでgridのサイズ変更を監視し、線を描画
        const observer = new ResizeObserver(() => {
            drawBracketLines();
            // 一度描画したら監視を停止（初回レイアウト時のみで良いため）
            observer.disconnect();
        });
        observer.observe(grid);
    }

    // SVGで線を描画
    function drawBracketLines() {
        const svg = tournamentBracketDiv.querySelector('.bracket-svg-overlay');
        const grid = tournamentBracketDiv.querySelector('.tournament-grid');
        if (!svg || !grid) return;

        // SVGのサイズをグリッドのスクロール可能サイズに合わせる
        svg.setAttribute('width', grid.scrollWidth);
        svg.setAttribute('height', grid.scrollHeight);
        svg.innerHTML = ''; // 既存の線をクリア

        const gridRect = grid.getBoundingClientRect();

        for (let i = 1; i < tournamentState.rounds.length; i++) {
            const round = tournamentState.rounds[i];
            const prevRound = tournamentState.rounds[i - 1];

            round.matches.forEach((match, matchIndex) => {
                const matchElement = document.getElementById(match.id);
                if (!matchElement) return;

                const prevMatch1 = document.getElementById(prevRound.matches[matchIndex * 2]?.id);
                const prevMatch2 = document.getElementById(prevRound.matches[matchIndex * 2 + 1]?.id);

                if (prevMatch1 && prevMatch2) {
                    const rect1 = prevMatch1.getBoundingClientRect();
                    const rect2 = prevMatch2.getBoundingClientRect();
                    const rectTarget = matchElement.getBoundingClientRect();

                    // getBoundingClientRectで取得した画面座標を、gridコンテナ内の相対座標に変換
                    const start1_x = rect1.right - gridRect.left + grid.scrollLeft;
                    const start1_y = rect1.top - gridRect.top + grid.scrollTop + rect1.height / 2;
                    const start2_x = rect2.right - gridRect.left + grid.scrollLeft;
                    const start2_y = rect2.top - gridRect.top + grid.scrollTop + rect2.height / 2;
                    const end_x = rectTarget.left - gridRect.left + grid.scrollLeft;
                    const end_y = rectTarget.top - gridRect.top + grid.scrollTop + rectTarget.height / 2;

                    const mid_x = start1_x + (end_x - start1_x) / 2;

                    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    const d = `M ${start1_x} ${start1_y} L ${mid_x} ${start1_y} L ${mid_x} ${start2_y} M ${start2_x} ${start2_y} L ${mid_x} ${start2_y} M ${mid_x} ${end_y} L ${end_x} ${end_y}`;
                    path.setAttribute('d', d);
                    svg.appendChild(path);
                }
            });
        }
    }
});
