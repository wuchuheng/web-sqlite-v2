<template>
    <div class="io-arrows">
        <!-- Right Arrow -->
        <svg width="40" height="20" viewBox="0 0 40 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 10H36M36 10L28 4M36 10L28 16" stroke="#2d2d2d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <!-- Left Arrow -->
        <svg width="40" height="20" viewBox="0 0 40 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M38 10H4M4 10L12 16M4 10L12 4" stroke="#2d2d2d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    </div>
</template>

<style scoped>
.io-arrows {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
    justify-content: center;
    opacity: 0.8;
}

@media (max-width: 768px) {
    .io-arrows { 
        transform: rotate(90deg); 
        flex-direction: row; 
        gap: 14px;
    }
}
</style>
