<script lang="ts">
    import { booth } from "./service/booth"
</script>

{#if $booth}
    <aside data-testid="booth-status" aria-label="Service time">
        <p>Current time <strong data-testid="booth-now">{$booth.now}</strong></p>
        <p>Advertised time <strong data-testid="booth-advertised">{$booth.advertised}</strong></p>
        <p>Time remaining <strong data-testid="booth-remaining">{$booth.remaining}</strong></p>
        <p class="line" data-testid="booth-countdown">{$booth.line}</p>
    </aside>
{/if}

<style>
    aside {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 16px;
        padding: 8px 12px;
        background: var(--primary);
        color: var(--text);
        border-bottom: 1px solid var(--primary-lighter);
        font-size: 16px;
    }

    p {
        margin: 0;
    }

    .line {
        flex: 1 0 100%;
        min-width: 0;
        white-space: normal;
    }
</style>
