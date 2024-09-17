import React, { useState } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { useDropzone } from 'react-dropzone';

const ffmpeg = new FFmpeg();

const App: React.FC = () => {
  const [text, setText] = useState<string>('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoURL, setVideoURL] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const { getRootProps, getInputProps } = useDropzone({ onDrop: (acceptedFiles) => setVideoFile(acceptedFiles[0]) });

  // Function to generate audio from TTS (using Speech Synthesis and capturing output)
  const generateAudioFromText = async (text: string): Promise<Blob> => {
    return new Promise((resolve) => {
      const synth = window.speechSynthesis;
      const utterance = new SpeechSynthesisUtterance(text);
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();
      const mediaRecorder = new MediaRecorder(destination.stream);
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: 'audio/mp3' });
        resolve(audioBlob);
      };

      const source = audioContext.createMediaStreamSource(destination.stream);
      source.connect(audioContext.destination);
      mediaRecorder.start();
      synth.speak(utterance);
      utterance.onend = () => {
        mediaRecorder.stop();
      };
    });
  };

  // Fetch video from a URL
  const fetchVideoFromURL = async (videoURL: string): Promise<Blob> => {
    try {
      const response = await fetch(videoURL);
      if (!response.ok) {
        throw new Error(`Network response was not ok: ${response.statusText}`);
      }
      const videoBlob = await response.blob();
      return videoBlob;
    } catch (error) {
      console.error('Error fetching video:', error);
      throw error; // Re-throw error after logging it
    }
  };
  

  // Combine video and audio using FFmpeg
  const combineAudioAndVideo = async (videoBlob: Blob, audioBlob: Blob) => {
    setLoading(true);
    if (!ffmpeg.loaded) {
      await ffmpeg.load();
    }

    await ffmpeg.writeFile('video.mp4', new Uint8Array(await videoBlob.arrayBuffer()));
    await ffmpeg.writeFile('audio.mp3', new Uint8Array(await audioBlob.arrayBuffer()));

    await ffmpeg.exec(['-i', 'video.mp4', '-i', 'audio.mp3', '-c:v', 'copy', '-c:a', 'aac', 'output.mp4']);

    const data = await ffmpeg.readFile('output.mp4');
    const videoWithAudioUrl = URL.createObjectURL(new Blob([data], { type: 'video/mp4' }));
    const link = document.createElement('a');
    link.href = videoWithAudioUrl;
    link.download = 'output.mp4';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setLoading(false);
  };

  // Handle form submit
  const handleSubmit = async () => {
    if (!text) {
      alert('Please enter text for TTS.');
      return;
    }

    setLoading(true);

    let videoBlob: Blob | null = null;

    // Determine whether to use file upload or URL input
    if (videoFile) {
      videoBlob = videoFile;
    } else if (videoURL) {
      videoBlob = await fetchVideoFromURL(videoURL);
    }

    if (!videoBlob) {
      alert('Please provide a valid video.');
      setLoading(false);
      return;
    }

    // Generate audio from text
    const audioBlob = await generateAudioFromText(text);

    // Combine audio and video and generate the final output
    await combineAudioAndVideo(videoBlob, audioBlob);
    setLoading(false);
  };

  return (
    <div>
      <h1>Video Generator with TTS</h1>

      {/* Text area for text input */}
      <textarea
        placeholder="Enter text for TTS"
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={{ width: '100%', height: '100px' }}
      />

      {/* Dropzone for video upload */}
      <div {...getRootProps()} style={{ border: '2px dashed black', padding: '20px', margin: '10px 0' }}>
        <input {...getInputProps()} />
        <p>Drag 'n' drop a video file, or click to select one</p>
      </div>

      {/* URL input for video */}
      <input
        type="text"
        placeholder="Or enter video URL"
        value={videoURL}
        onChange={(e) => setVideoURL(e.target.value)}
        style={{ width: '100%' }}
      />

      {/* Button to generate the video */}
      <button onClick={handleSubmit} disabled={loading}>
        {loading ? 'Generating Video...' : 'Generate Video'}
      </button>
    </div>
  );
};

export default App;
