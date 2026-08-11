This is hosted with GitHub pages and linked to Webflow in the before body custom code section.

The repo has to be public but everything in the `/docs` folder is what's published on the CDN.

Custom code:

```html
<script>
    window.dataLayer = window.dataLayer || [];

    window.dataLayer.push({
        event: 'page_context',
        page_type: 'guide',
        page_name: '{{wf {&quot;path&quot;:&quot;name&quot;,&quot;type&quot;:&quot;PlainText&quot;} }}',
        content_group: 'guide',
        guide_name: '{{wf {&quot;path&quot;:&quot;name&quot;,&quot;type&quot;:&quot;PlainText&quot;} }}',
    });
</script>

<link
    rel="stylesheet"
    href="https://reece-halo.github.io/webflow-guide-search/live.css"
/>

<script
    src="https://reece-halo.github.io/webflow-guide-search/live.js"
    defer
></script>
```
