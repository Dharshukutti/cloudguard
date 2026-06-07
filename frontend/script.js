fetch("http://127.0.0.1:5000/api/dashboard/summary")
  .then(response => response.json())
  .then(data => {
    console.log("DATA:", data);

    document.getElementById("totalUsers").innerText = data.total_users;
    document.getElementById("highRisk").innerText = data.high_risk;
    document.getElementById("mediumRisk").innerText = data.medium_risk;
    document.getElementById("lowRisk").innerText = data.low_risk;
  })
  .catch(error => {
    console.error("ERROR:", error);
  });