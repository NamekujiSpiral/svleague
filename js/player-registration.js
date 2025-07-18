// HTML要素の取得
const registerButton = document.getElementById('registerButton');
const playerNameInput = document.getElementById('playerName');
const playerList = document.getElementById('playerList');

// 登録ボタンのクリックイベント
registerButton.addEventListener('click', () => {
    const playerName = playerNameInput.value;
    if (playerName.trim() !== '') {
        // Firestoreにプレイヤーを追加
        db.collection('players').add({
            name: playerName,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        })
            .then(() => {
                console.log('プレイヤーを登録しました:', playerName);
                playerNameInput.value = ''; // 入力欄をクリア
            })
            .catch((error) => {
                console.error('登録エラー:', error);
            });
    }
});

// Firestoreからプレイヤーをリアルタイムで取得して表示
db.collection('players').orderBy('timestamp', 'desc')
    .onSnapshot((snapshot) => {
        playerList.innerHTML = ''; // リストをクリア
        snapshot.forEach((doc) => {
            const player = doc.data();
            const li = document.createElement('li');
            li.textContent = player.name;
            playerList.appendChild(li);
        });
    });