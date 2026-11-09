# Place looped MP4/AVI test clips here.
# Filenames must match the rtsp_url values in data/cameras.json:
#   sample_01.mp4 → CAM_001
#   sample_02.mp4 → CAM_002
#   ...
#   sample_10.mp4 → CAM_010
#
# Any publicly available traffic/street footage works.
# Recommended sources (check licensing before use):
#   - Pexels: https://www.pexels.com/search/videos/traffic/
#   - Pixabay: https://pixabay.com/videos/search/traffic/
#   - OpenCV test videos: https://github.com/opencv/opencv/tree/master/samples/data
#
# Minimum requirements:
#   - Resolution: 640×480 or higher
#   - Duration: at least 30 seconds (looped by the worker)
#   - Format: H.264 MP4 (OpenCV-compatible)
#
# This directory is .gitignored to avoid storing binary files in the repo.
# The planted-vehicle generator does NOT require video files.
