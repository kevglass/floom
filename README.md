# floom - A free recording tool with inset video

![image](https://user-images.githubusercontent.com/3787210/210331272-51e713d0-696f-4e24-9169-78c866eab829.png)

This is a simple tool to record a section of the screen for demos with an overlaid video blob. 
It was created in a few hours using the wealth of Web APIs around because a certain other tool wanted to charge
$8 a month for the record section of the screen feature!

## To Install

1) Install NPM - https://docs.npmjs.com/downloading-and-installing-node-js-and-npm
2) Install Dependences - ```npm install```

## To Run

```npm run start```

## To Use

- Use the drag handle (in the top right) and the size handle (in the bottom left) to select the section of the screen to record. 
- Drag the webcam video to anywhere that you want
- Hit the Start Recording button to start recording the screen and audio. You'll get a 5 second count in.
- Hit the Stop Record button to stop recording and save the output video.

## Limitations

- Floom currently picks your first screen to record from
- Floom currently picks the system assigned camera and microphone
- Floom currently outputs a webm - good for youtube, but might need converting to MP4 elsewhere
