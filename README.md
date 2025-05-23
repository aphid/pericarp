# pericarp
lightweight tool for hooking things to timestamp ranges in HTML5 audio or video. 

inspired by the functions in popcornjs i used the most.

a pericarp is the tough, outer shell of a popcorn kernel, crucial for the popping process.

pericarp.cue takes several arguments:

1. the dom object being targeted (audio or video tags) OR a CSS selector string (what you'd use in querySelector) that will point at one of those tags.
2. start time in seconds OR hh:mm:ss OR mm:ss
3. end time in same formats
4. function to run (once) when in between the start and end time
5. OPTIONAL function to run when leaving the timespan.

here's a very basic example that will make the annotation div visible between 5 and 10 seconds
```
...
<head>
<script src="pericarp.js"></script>
<style>
   #annotation { opacity: 0; transition: all 1s linear; }
</style>
</head>
<body>
<video src="vapormario.mp4" controls>
<div id="annotation">HWG with some hot doctor pepper! 🍿🍿🍿🍿🍿</div>

<script>
let video = document.querySelector("video")
let annotate = document.querySelector("#annotation")

//make our annotation visible between 5 & 10 seconds.
pericarp.cue(video, 5,10,function(){
   annotate.style.opacity = 1;
},function(){
   //hide the annotation
   annotate.style.opacity = 0;
});

//when you get within 10 seconds from the end, go back to the beginning
pericarp.cue(video, video.duration - 10, video.duration, backToStart); 

function backToStart(){
   video.currentTime = 0;
}

</script>
...
```
