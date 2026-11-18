<script lang="ts">
    import { booth } from "./service/booth"
</script>

{#if $booth}
    <aside data-testid="booth-status" aria-label="Service time">
        <p>Current time <strong data-testid="booth-now">{$booth.now}</strong></p>
        <p>Advertised time <strong data-testid="booth-advertised">{$booth.advertised}</strong></p>
        <p>Time remaining <strong data-testid="booth-remaining">{$booth.remaining}</strong></p>
        <p data-testid="booth-countdown">{$booth.line}</p>
    </aside>
{/if}

<style>
    aside {
        position: fixed;
        left: 16px;
        bottom: 16px;
        z-index: 20;
        display: flex;
        flex-wrap: wrap;
        gap: 8px 20px;
        max-width: calc(100% - 32px);
        padding: 10px 14px;
        background: var(--primary);
        color: var(--text);
        border: 2px solid var(--primary-lighter);
        border-radius: 10px;
        font-size: 18px;
    }

    p {
        margin: 0;
    }
</style>
