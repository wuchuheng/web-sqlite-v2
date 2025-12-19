<script setup>
defineProps({
  data: Array,
});
</script>

<template>
  <div class="table-container">
      <table class="data-view">
        <thead>
          <tr>
            <th>ID</th>
            <th>username</th>
            <th>email</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="data.length === 0">
            <td colspan="3" style="text-align: center; color: #999">No results</td>
          </tr>
          <tr v-for="row in data" :key="row.id">
            <td>{{ row.id }}</td>
            <td>{{ row.username }}</td>
            <td>{{ row.email }}</td>
          </tr>
        </tbody>
      </table>
  </div>
</template>

<style scoped>
.table-container {
    flex: 2;
    width: 100%;
}

.data-view {
  width: 100%;
  border-collapse: collapse;
  background: #fdfbf6;
  border: 2px solid #2d2d2d;
  border-radius: 8px; /* Slightly rounded corners for hand-drawn feel */
  overflow: hidden;
  box-shadow: 2px 2px 0 rgba(0,0,0,0.1);
  font-family: 'Kalam', cursive;
}

th,
td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 2px solid #2d2d2d;
  border-right: 2px solid #2d2d2d;
  color: #1f1f1f;
  font-size: 14px;
}

th {
  background: #f0ede6; /* Slightly darker than row bg */
  font-weight: 700;
}

th:last-child,
td:last-child {
  border-right: none;
}

tr:last-child td {
  border-bottom: none;
}
</style>
