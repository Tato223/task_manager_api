fetch("http://127.0.0.1:8000/tasks?offset=0&limit=20")
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.log("Error: ", error));