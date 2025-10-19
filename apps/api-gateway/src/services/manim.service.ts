import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export interface VideoGenerationRequest {
  code: string;
  complexity: string;
  prompt: string;
  quality?: "low" | "medium" | "high";
}

export interface VideoGenerationResponse {
  videoId: string;
  status: "processing" | "failed" | "completed";
  videoUrl?:string;
  error?:string;
}

export class ManimService{
  private readonly tempDir:string;
  private readonly outDir:string;

  constructor(){
    this.tempDir = path.join(process.cwd(),"tmp");
    this.outDir = path.join(process.cwd(),"out");

    this.ensureDirectories();
  }

  private readonly ensureDirectories =async()=>{
    try{
      await fs.mkdir(this.tempDir,{recursive:true});
      await fs.mkdir(this.outDir,{recursive:true});

    }catch(e){
      console.error(e,"Error creating Directories");
    }
  }

  async generateVideo(request:VideoGenerationRequest):Promise<VideoGenerationResponse>{
    const videoId =uuidv4();
    const timestamp = new Date().getTime();

    try{
      const pythonFileName = `animation_${timestamp}.py`;
      const pythonFilePath = path.join(this.tempDir,pythonFileName);

      await fs.writeFile(pythonFilePath,request.code);
      const qualityFlag = this.getQualityFlag(request.quality||'medium');

      const outputPath = this.runManim(pythonFilePath,qualityFlag,videoId);

      await fs.unlink(pythonFilePath);

      return{
        videoId,
        status:'completed',
        videoUrl:`/api/videos/${videoId}.mp4`,
      }}
      catch(error){
        console.error(error,"Video generation failed");
        return {
          videoId,
          status:'failed',
          error:error instanceof Error?error.message:'Video generation failed'
        }
      }

  }
 private getQualityFlag(quality:string):string{
  const qualityMap ={
         low: '-ql',
      medium: '-qm', 
      high: '-qh'
  }
  return qualityMap[quality as keyof typeof qualityMap]||'-qm';
 }


 private runManim(pythonFilePath:string,qualityFlag:string,videoId:string):Promise<string>{
  return new Promise((resolve,reject)=>{
    const className = this.extractClassName(pythonFilePath);
    const outputPath = path.join(this.outDir,`${videoId}.mp4`);
    const args=[
      pythonFilePath,
      className,
      qualityFlag,
      '--output-filename',outputPath
    ];

    const manimProcess = spawn('manim',args,{
      stdio:['pipe','pipe','pipe']
    });

    let stdout = '';
    let stderr = '';

    manimProcess.stdout.on('data',(data)=>{
      stdout+=data.toString();
    });

    manimProcess.stderr.on('data',(data)=>{
      stderr+=data.toString();
    })
    manimProcess.on('close',(code)=>{
      if(code===0){
        resolve(outputPath);
      }
      else{
        reject(new Error('Manim process failed with code'))
      }
    });

    manimProcess.on('error',(error)=>{
      reject(new Error("Failed to start manim process"))
    });

    setTimeout(()=>{
      manimProcess.kill();
      reject(new Error('Video generation timeout'));
      
    },3000);
  });
 }


 private extractClassName(pythonFilePath:string):string{
       try {
      const content = require('fs').readFileSync(pythonFilePath, 'utf8');
      const classMatch = content.match(/class\s+(\w+)\s*$$/);
      return classMatch ? classMatch : 'GeneratedAnimation';[1]
    } catch {
      return 'GeneratedAnimation';
    }
  }
 }

