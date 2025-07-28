document.addEventListener('DOMContentLoaded', () => {
    const playerSelectionList = document.getElementById('player-selection-list');
    const pickWinnerButton = document.getElementById('pick-winner-button');
    const winnerDisplay = document.getElementById('winner-display');
    const winnerName = document.getElementById('winner-name');

    db.collection('players').orderBy('name', 'asc').get().then(querySnapshot => {
        const allPlayers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        allPlayers.forEach(player => {
            const playerId = player.id;

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = playerId;
            checkbox.value = JSON.stringify(player); // プレイヤーオブジェクトを文字列化して格納
            checkbox.dataset.id = playerId;

            const label = document.createElement('label');
            label.htmlFor = playerId;
            label.textContent = `[${player.rank || 'None'}] ${player.name}`;

            const div = document.createElement('div');
            div.appendChild(checkbox);
            div.appendChild(label);
            playerSelectionList.appendChild(div);
        });
    });

    pickWinnerButton.addEventListener('click', () => {
        const selectedCheckboxes = Array.from(playerSelectionList.querySelectorAll('input[type="checkbox"]:checked'));
        const selectedPlayers = selectedCheckboxes.map(cb => JSON.parse(cb.value));

        if (selectedPlayers.length < 2) {
            alert('プレイヤーを2人以上選択してください。');
            return;
        }

        pickWinnerButton.disabled = true;
        winnerDisplay.style.display = 'none';
        winnerDisplay.classList.add('winner-animation');
        winnerDisplay.classList.remove('winner');

        const resultPrefix = document.getElementById('result-prefix');
        resultPrefix.style.visibility = 'hidden';

        const duration = 2000; // 2秒間の演出
        const interval = 30;   // 30ミリ秒ごとに名前を切り替え

        const animation = setInterval(() => {
                const randomPlayer = selectedPlayers[Math.floor(Math.random() * selectedPlayers.length)];
                winnerName.textContent = randomPlayer.name;
                winnerDisplay.style.display = 'block';
            }, interval);

            setTimeout(() => {
                clearInterval(animation);
                const finalWinner = selectedPlayers[Math.floor(Math.random() * selectedPlayers.length)];
                winnerName.textContent = finalWinner.name;
                resultPrefix.style.visibility = 'visible';
                winnerDisplay.classList.remove('winner-animation');
                winnerDisplay.classList.add('winner');
                pickWinnerButton.disabled = false;
            }, duration);
    });
});