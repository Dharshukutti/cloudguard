// Dashboard Summary + Chart

fetch("http://127.0.0.1:5000/api/dashboard/summary")
  .then(response => response.json())
  .then(data => {

    document.getElementById("totalUsers").innerText = data.total_users;
    document.getElementById("highRisk").innerText = data.high_risk;
    document.getElementById("mediumRisk").innerText = data.medium_risk;
    document.getElementById("lowRisk").innerText = data.low_risk;

    const ctx = document.getElementById("riskChart");

    new Chart(ctx, {
      type: "pie",
      data: {
        labels: ["High Risk", "Medium Risk", "Low Risk"],
        datasets: [{
          data: [
            data.high_risk,
            data.medium_risk,
            data.low_risk
          ]
        }]
      }
    });

  });


// Users Table

fetch("http://127.0.0.1:5000/api/users")
  .then(response => response.json())
  .then(users => {

    const tbody =
      document.querySelector("#usersTable tbody");

    tbody.innerHTML = "";

    users.forEach(user => {

      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${user.UserName}</td>
        <td>${user.RiskScore}</td>
        <td>
          <span class="status ${user.Status.toLowerCase()}">
            ${user.Status}
          </span>
        </td>
        <td>${user.Reason}</td>
      `;

      tbody.appendChild(row);

    });

  });