<?php
// nginx config: try_files, if not then do fastcgi 404 of this script: https://serverfault.com/questions/415705/nginx-dynamic-php-404-with-url-rewriting
// 1. look at actual request URL and get out: z/x/y/n of tiles to be combined/processing mode
// 2. get n*n jpeg(s) from main, load them as image resources
// 3. perform processing on all n*n together as a junk
// 4. return request tile and close connection: https://www.php.net/manual/en/function.imagejpeg.php
// 5. write all tiles to relevant paths on disk so that they can be served directly next time
// TODO would be great if the remaining (n*n)-1 tiles would already be served from disk, but this will depend on how nginx processes the request queue from one client??
?>
