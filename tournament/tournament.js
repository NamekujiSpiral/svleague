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

    // トーナメント生成ボタンのクリックイベント
    generateTournamentButton.addEventListener('click', () => {
        const selectedPlayerIds = Array.from(playerSelectionList.querySelectorAll('input[type="checkbox"]:checked'))
            .map(cb => cb.value);

        const selectedPlayers = allPlayers.filter(p => selectedPlayerIds.includes(p.id));

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

    function initializeTournament(players, group) {
        const shuffled = [...players].sort(() => Math.random() - 0.5);
        const total = Math.pow(2, Math.ceil(Math.log2(shuffled.length)));
        const byes = total - shuffled.length;

        // 1) 全枠を null で初期化
        const slots = Array(total).fill(null);

        // 2) 再帰で BYE 配分
        function distributeByes(start, end, k) {
            // [start, end) を区間とする
            const len = end - start;
            if (k === 0) return;
            if (k === len) {
                for (let i = start; i < end; i++) slots[i] = '不戦勝';
                return;
            }
            const mid = start + Math.floor(len / 2);
            const leftByes = Math.ceil(k / 2);
            const rightByes = k - leftByes;
            distributeByes(start, mid, leftByes);
            distributeByes(mid, end, rightByes);
        }
        distributeByes(0, total, byes);

        // 3) 残り枠にプレイヤーを詰める
        let p = 0;
        for (let i = 0; i < total; i++) {
            if (slots[i] === null) slots[i] = shuffled[p++];
        }

        // 4) あとは通常のトーナメント構築ロジック
        tournamentState = { rounds: [], players, group };
        let current = slots, roundIdx = 0, matchNo = 0;

        while (current.length > 1) {
            const round = { matches: [] };
            for (let i = 0; i < current.length; i += 2) {
                const m = {
                    id: `r${roundIdx}m${i / 2}`,
                    player1: current[i],
                    player2: current[i + 1],
                    winner: null,
                    roundIndex: roundIdx,
                    group,
                    matchNumber: ++matchNo
                };
                if (m.player1 === '不戦勝') m.winner = m.player2;
                else if (m.player2 === '不戦勝') m.winner = m.player1;
                round.matches.push(m);
            }
            tournamentState.rounds.push(round);
            current = round.matches.map(m => m.winner);
            roundIdx++;
        }

        // 優勝マッチ（最後に１人残った場合）
        if (current.length === 1) {
            tournamentState.rounds.push({
                matches: [{
                    id: `r${roundIdx}m0`,
                    player1: current[0],
                    player2: null,
                    winner: current[0],
                    roundIndex: roundIdx
                }]
            });
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
        if (semiFinal && semiFinal.matches.length === 1 && semiFinal.matches[0].winner) {
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
            const winner = tournamentState.rounds[tournamentState.rounds.length - 1].matches[0].winner;
            if (winner) {
                matchListDiv.innerHTML = `<div class="winner"><h3>優勝: ${winner.name}</h3></div>`;
            }
        }
    }

    // 結果入力用の対戦要素を作成
    function createMatchInputElement(match) {
        const matchDiv = document.createElement('div');
        matchDiv.classList.add('match');

        const matchInfoSpan = document.createElement('span');
        matchInfoSpan.classList.add('match-number');
        matchInfoSpan.textContent = (match.group && match.group !== 'all') ? `${match.group}${match.matchNumber}: ` : `${match.matchNumber}: `;

        const playersDiv = document.createElement('div');
        playersDiv.classList.add('match-players');
        const player1Display = match.player1 === '不戦勝' ? '不戦勝' : match.player1.name;
        const player2Display = match.player2 === '不戦勝' ? '不戦勝' : match.player2.name;
        playersDiv.textContent = `${player1Display} vs ${player2Display}`;

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
    function createPlayerDiv(player, winner) {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'player';
        if (player) {
            if (typeof player === 'string') { // "不戦勝"の場合
                playerDiv.textContent = player;
            } else {
                playerDiv.textContent = player.name;
            }
        } else {
            playerDiv.innerHTML = '&nbsp;'; // プレースホルダー
        }

        if (player === '不戦勝') playerDiv.classList.add('bye');
        if (player && winner && (player.name === winner.name)) playerDiv.classList.add('winner');
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

                if (roundIndex !== tournamentState.rounds.length - 1) {
                    const matchIdDiv = document.createElement('div');
                    matchIdDiv.className = 'match-id';
                    matchIdDiv.textContent = (match.group && match.group !== 'all') ? `${match.group}${match.matchNumber}` : `${match.matchNumber}`;
                    matchDiv.appendChild(matchIdDiv); // ここで追加
                }

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

        // 最終戦から優勝者への線を描画
        if (tournamentState.rounds.length > 1) {
            const finalRoundIndex = tournamentState.rounds.length - 1;
            const semiFinalRoundIndex = finalRoundIndex - 1;
            const finalMatch = tournamentState.rounds[finalRoundIndex].matches[0];
            const semiFinalMatch = tournamentState.rounds[semiFinalRoundIndex].matches[0];

            if (finalMatch && semiFinalMatch) {
                const finalElement = document.getElementById(finalMatch.id);
                const semiFinalElement = document.getElementById(semiFinalMatch.id);

                if (finalElement && semiFinalElement) {
                    const rect1 = semiFinalElement.getBoundingClientRect();
                    const rectTarget = finalElement.getBoundingClientRect();

                    const start_x = rect1.right - gridRect.left + grid.scrollLeft;
                    const start_y = rect1.top - gridRect.top + grid.scrollTop + rect1.height / 2;
                    const end_x = rectTarget.left - gridRect.left + grid.scrollLeft;
                    const end_y = rectTarget.top - gridRect.top + grid.scrollTop + rectTarget.height / 2;

                    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    const d = `M ${start_x} ${start_y} L ${end_x} ${end_y}`;
                    path.setAttribute('d', d);
                    svg.appendChild(path);
                }
            }
        }
    }
});
